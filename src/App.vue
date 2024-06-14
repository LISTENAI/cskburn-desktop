<template>
  <n-flex vertical :size="16" :style="{
    boxSizing: 'border-box',
    height: '100vh',
    padding: '16px'
  }">
    <auto-updater />

    <n-spin :show="busyForInfo" :style="{ width: '600px' }">
      <n-descriptions :column="2" label-placement="left" :label-class="$style.infoLabel">
        <n-descriptions-item label="串口" :span="2" :label-style="{ verticalAlign: 'middle' }"
          :content-style="{ verticalAlign: 'middle' }">
          <n-space>
            <port-selector v-model:port="selectedPort" :disabled="busyForInfo || busyForFlash"
              :style="{ width: '300px' }" />
            <n-button secondary :disabled="selectedPort == null || busyForInfo || busyForFlash"
              :style="{ width: '6em' }" @click="fetchInfo">
              获取信息
            </n-button>
          </n-space>
        </n-descriptions-item>
        <n-descriptions-item label="Chip ID" :content-style="{ width: '12em' }">
          <n-element :class="$style.infoText">
            <selectable-text selectable>{{ chipId || 'N/A' }}</selectable-text>
          </n-element>
        </n-descriptions-item>
        <n-descriptions-item label="Flash ID" :content-style="{ width: '12em' }">
          <n-element :class="$style.infoText">
            <selectable-text selectable>{{ flashInfo || 'N/A' }}</selectable-text>
          </n-element>
        </n-descriptions-item>
      </n-descriptions>
    </n-spin>

    <partition-view v-model:image="image" :busy="busyForFlash" :progress :errors :style="{ flex: '1 1 auto' }" />

    <n-flex align="center">
      <n-flex align="center" :style="{ width: 'auto', flex: '1 1 auto' }">
        <template v-if="status == FlashStatus.CONNECTING">
          <n-spin size="small" />
        </template>
        <template v-else-if="status == FlashStatus.FLASHING || status == FlashStatus.VERIFYING">
          <n-progress type="line" :percentage="progress.progress * 100" :show-indicator="false"
            :processing="status == FlashStatus.VERIFYING" />
        </template>
        <template v-else-if="status == FlashStatus.SUCCESS">
          <n-text :class="$style.result" type="success">
            烧录成功
          </n-text>
        </template>
        <template v-else-if="status == FlashStatus.ERROR">
          <n-text :class="$style.result" type="error">
            烧录异常
          </n-text>
        </template>
      </n-flex>

      <n-button quaternary :type="outputShown ? 'primary' : 'default'" :focusable="false"
        @click="() => outputShown = !outputShown">
        <template #icon>
          <n-icon>
            <list-16-regular />
          </n-icon>
        </template>
      </n-button>

      <n-button v-if="busyForFlash" size="large" :style="{ flex: '0 0 140px' }" @click="stopFlash">
        停止
      </n-button>
      <n-button v-else size="large" type="primary" :disabled="!readyToFlash || busyForInfo"
        :style="{ flex: '0 0 140px' }" @click="startFlash">
        开始烧录
      </n-button>
    </n-flex>

    <log-view v-if="outputShown" :logs="output.join('\n')" :style="{ height: '200px' }" />
  </n-flex>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import {
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NElement,
  NFlex,
  NIcon,
  NSpace,
  NProgress,
  NSpin,
  NText,
  useMessage,
} from 'naive-ui';
import { getCurrent, ProgressBarStatus, UserAttentionType } from '@tauri-apps/api/window';
import { confirm } from '@tauri-apps/plugin-dialog';
import { List16Regular } from '@vicons/fluent';
import { throttle } from 'radash';
import { imageSize, type IFlashImage } from '@/utils/images';
import { cskburn, type ICSKBurnResult } from '@/utils/cskburn';
import { cleanUpTmpFiles } from '@/utils/file';

import { busyOn } from '@/composables/busyOn';
import { FlashStatus, useFlashProgress } from './composables/progress';
import { useListen } from '@/composables/tauri/useListen';

import AutoUpdater from '@/components/sections/AutoUpdater.vue';
import PortSelector from '@/components/sections/PortSelector.vue';
import PartitionView from '@/components/sections/PartitionView.vue';
import LogView from '@/components/sections/LogView.vue';

import SelectableText from '@/components/common/SelectableText.vue';

const selectedPort = ref<string | null>(null);
const image = ref<IFlashImage | null>(null);

const chipId = ref<string | null>(null);
const flashId = ref<string | null>(null);
const flashSize = ref<number | null>(null);

const flashInfo = computed(() => {
  if (flashId.value != null && flashSize.value != null) {
    return `${flashId.value} (${Math.round(flashSize.value / 1024 / 1024)} MB)`;
  }
});

const status = ref<FlashStatus | null>(null);
const progress = useFlashProgress(image, status);

const busyForInfo = ref(false);
const busyForFlash = computed(() =>
  status.value == FlashStatus.CONNECTING ||
  status.value == FlashStatus.FLASHING ||
  status.value == FlashStatus.VERIFYING);

const readyToFlash = computed(() => selectedPort.value != null && image.value != null && !hasError.value);

const message = useMessage();

async function fetchInfo(): Promise<void> {
  chipId.value = null;
  flashId.value = null;
  flashSize.value = null;
  output.value.splice(0);

  let result: ICSKBurnResult | undefined;
  let error: unknown;

  try {
    result = await busyOn(cskburn(selectedPort.value!, 1500000, [], {
      onOutput(line) {
        output.value.push(line);
      },
      onChipId(id) {
        chipId.value = id;
      },
      onFlashId(id, size) {
        flashId.value = id;
        flashSize.value = size;
      },
    }), busyForInfo);
  } catch (e) {
    console.error(e);
    error = e;
  }

  if (error) {
    message.error('获取信息失败');
    output.value.push(`[获取信息失败: 发生异常 ${error}]`);
  } else if (result?.signal != null) {
    message.error('获取信息失败');
    output.value.push(`[获取信息失败: 终止信号 ${result.signal}]`);
  } else if (result?.code != null && result.code != 0) {
    message.error('获取信息失败');
    output.value.push(`[获取信息失败: 退出码 ${result.code}]`);
  } else {
    output.value.push('[获取信息成功]');
  }
}

const errors = computed(() => {
  if (image.value?.format == 'bin') {
    return image.value.partitions.map((partition, _index, partitions) => {
      const start = partition.addr;
      const end = start + partition.file.size;

      for (const [otherIndex, other] of partitions.entries()) {
        if (partition == other) {
          continue;
        }

        const otherStart = other.addr;
        const otherEnd = otherStart + other.file.size;

        if (!(start >= otherEnd || end <= otherStart)) {
          return `与分区 #${otherIndex + 1} 重叠`;
        }
      }

      if (start % 4096 != 0) {
        return '地址未 4K 对齐';
      }

      if (flashSize.value != null && end > flashSize.value) {
        return '超出 Flash 大小';
      }
    });
  } else if (image.value?.format == 'hex') {
    if (flashSize.value != null && imageSize(image.value) > flashSize.value) {
      return ['超出 Flash 大小'];
    }
  }

  return [];
});

const hasError = computed(() => errors.value.some((error) => !!error));

const output = ref<string[]>([]);
const outputShown = ref(false);

watch(image, () => {
  progress.current = null;
  status.value = null;
});

let aborter: AbortController | undefined;

async function startFlash(): Promise<void> {
  const args = ['--verify-all'];
  if (image.value == null) {
    return;
  } else if (image.value.format == 'hex') {
    args.push(image.value.file.path);
  } else if (image.value.format == 'bin') {
    for (const part of image.value.partitions) {
      args.push(part.addr.toString(), part.file.path);
    }
  }

  aborter = new AbortController();

  progress.current = null;
  output.value.splice(0);
  status.value = FlashStatus.CONNECTING;

  let result: ICSKBurnResult | undefined;
  let error: unknown;

  try {
    result = await cskburn(selectedPort.value!, 1500000, args, {
      signal: aborter.signal,
      onOutput(line) {
        output.value.push(line);
      },
      onChipId(id) {
        chipId.value = id;
      },
      onFlashId(id, size) {
        flashId.value = id;
        flashSize.value = size;
      },
      onPartition(index, _total, _addr) {
        progress.current = { index, progress: 0 };
        status.value = FlashStatus.FLASHING;
      },
      onWrote(index) {
        progress.current = { index, progress: 1 };
        status.value = FlashStatus.VERIFYING;
      },
      onProgress(index, current) {
        progress.current = { index, progress: current };
      },
    });
  } catch (e) {
    console.error(e);
    error = e;
  }

  // @ts-ignore
  const stoppedManually = status.value == FlashStatus.STOPPED;

  if (error) {
    status.value = FlashStatus.ERROR;
    output.value.push(`[烧录失败: 发生异常 ${error}]`);
  } else if (stoppedManually) {
    // status 已经被设置为 STOPPED，这里不需要再次设置
    output.value.push('[烧录停止]');
  } else if (result?.signal != null) {
    status.value = FlashStatus.ERROR;
    output.value.push(`[烧录失败: 终止信号 ${result.signal}]`);
  } else if (result?.code != null && result.code != 0) {
    status.value = FlashStatus.ERROR;
    output.value.push(`[烧录失败: 退出码 ${result.code}]`);
  } else {
    status.value = FlashStatus.SUCCESS;
    output.value.push('[烧录成功]');
  }
}

function stopFlash(): void {
  status.value = FlashStatus.STOPPED;
  aborter?.abort();
}

const setProgressThrottled = throttle({ interval: 500 }, async (progress: number) =>
  await getCurrent().setProgressBar({
    status: ProgressBarStatus.Normal,
    progress,
  }));

watch([progress, status], async () => {
  switch (status.value) {
    case FlashStatus.CONNECTING:
      await getCurrent().setProgressBar({
        status: ProgressBarStatus.Indeterminate,
        progress: 0,
      });
      break;
    case FlashStatus.FLASHING:
    case FlashStatus.VERIFYING:
      setProgressThrottled(Math.round(progress.progress * 100));
      break;
    case FlashStatus.STOPPED:
    case FlashStatus.SUCCESS:
      await getCurrent().setProgressBar({
        status: ProgressBarStatus.None,
      });
      await getCurrent().requestUserAttention(UserAttentionType.Informational);
      break;
    case FlashStatus.ERROR:
      await getCurrent().setProgressBar({
        status: ProgressBarStatus.Error,
      });
      await getCurrent().requestUserAttention(UserAttentionType.Critical);
      break;
  }
});

useListen(() => getCurrent().onCloseRequested(async (event) => {
  if (busyForFlash.value) {
    const confirmed = await confirm('正在烧录，退出软件会导致烧录被终止。确定要退出吗？', {
      okLabel: '确定',
      cancelLabel: '取消',
    });
    if (confirmed) {
      stopFlash();
    } else {
      event.preventDefault();
      return;
    }
  }

  await cleanUpTmpFiles();
}));
</script>

<style lang="scss" module>
:global(body) {
  overflow: hidden;
  position: fixed;
  width: 100vw;
  height: 100vh;
  user-select: none;
  cursor: default;
}

.infoLabel {
  display: inline-block;
  width: 6em;
  text-align: right;
}

.infoText {
  font-family: var(--font-family-mono);
}

.result {
  font-size: 1.2em;
  font-weight: bold;
  margin-left: 8px;
}
</style>
