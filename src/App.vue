<template>
  <n-flex vertical :size="16" :style="{
    boxSizing: 'border-box',
    height: '100vh',
    padding: '16px'
  }">
    <auto-updater />

    <n-spin :show="busyForInfo" :style="{ width: 'fit-content' }">
      <n-flex vertical>
        <n-flex align="center" size="large">
          <n-flex align="center">
            <div>端口:</div>
            <port-selector v-model:port="selectedPort" :disabled="busyForInfo || busyForFlash"
              :style="{ width: '300px' }" />
          </n-flex>
          <n-flex align="center">
            <div>芯片:</div>
            <n-select v-model:value="selectedChip" placeholder="请选择芯片" :options="supportedChips"
              :disabled="busyForInfo || busyForFlash" :style="{ width: '8em' }" />
          </n-flex>
        </n-flex>
        <n-flex align="center" size="large">
          <n-button secondary :disabled="selectedPort == null || selectedChip == null || busyForInfo || busyForFlash"
            :style="{ width: '6em' }" @click="fetchInfo">
            获取信息
          </n-button>
          <div v-if="chipId">
            Chip ID: <selectable-text selectable>{{ chipId }}</selectable-text>
          </div>
          <div v-if="flashInfo">
            Flash ID: <selectable-text selectable>{{ flashInfo.id }}</selectable-text>
            ({{ Math.round(flashInfo.size / 1024 / 1024) }} MB)
          </div>
        </n-flex>
      </n-flex>
    </n-spin>

    <partition-view v-model:images="images" :busy="busyForFlash" :progress :errors :style="{ flex: '1 1 auto' }" />

    <log-view v-if="outputShown" :logs="output.join('\n')" :style="{ height: '200px' }" />

    <n-flex align="center" :wrap="false">
      <n-flex align="center" :style="{ flex: '1 1 auto', minWidth: '0' }">
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
            <template v-if="failure">
              烧录异常：<selectable-text selectable>{{ failure }}</selectable-text>
            </template>
            <template v-else>
              烧录异常
            </template>
          </n-text>
        </template>
      </n-flex>

      <n-flex align="center" :wrap="false" :style="{ flex: '0 0 auto' }">
        <n-tooltip>
          <template #trigger>
            <n-button quaternary :type="outputShown ? 'primary' : 'default'" :focusable="false"
              @click="() => outputShown = !outputShown">
              <template #icon>
                <n-icon>
                  <List16Regular />
                </n-icon>
              </template>
            </n-button>
          </template>
          <template v-if="outputShown">
            隐藏日志
          </template>
          <template v-else>
            显示日志
          </template>
        </n-tooltip>

        <n-button v-if="busyForFlash" size="large" :style="{ width: '140px' }" @click="stopFlash">
          停止
        </n-button>
        <n-button v-else size="large" type="primary" :disabled="!readyToFlash || busyForInfo"
          :style="{ width: '140px' }" @click="startFlash">
          开始烧录
        </n-button>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import {
  NButton,
  NFlex,
  NIcon,
  NProgress,
  NSelect,
  NSpin,
  NText,
  NTooltip,
  useMessage,
  type SelectOption,
} from 'naive-ui';
import { getCurrentWindow, ProgressBarStatus, UserAttentionType } from '@tauri-apps/api/window';
import { confirm } from '@tauri-apps/plugin-dialog';
import { List16Regular } from '@vicons/fluent';
import { throttle } from 'radash';

import type { IFlashImage } from '@/utils/images';
import { cskburn, CSKBurnTerminatedError, CSKBurnUnnormalExitError } from '@/utils/cskburn';
import { cleanUpTmpFiles } from '@/utils/file';

import { busyOn } from '@/composables/busyOn';
import { FlashStatus, useFlashProgress } from '@/composables/progress';
import { useHexImage, usePartitions } from '@/composables/partitions';
import { useListen } from '@/composables/tauri/useListen';

import AutoUpdater from '@/components/sections/AutoUpdater.vue';
import PortSelector from '@/components/sections/PortSelector.vue';
import PartitionView from '@/components/sections/PartitionView.vue';
import LogView from '@/components/sections/LogView.vue';

import SelectableText from '@/components/common/SelectableText.vue';

const BAUDRATE = 1_500_000;

const supportedChips: SelectOption[] = [
  { value: 'venus', label: 'CSK6' },
  { value: 'arcs', label: 'LS26' },
];

const selectedPort = ref<string | null>(null);
const selectedChip = ref<string | null>(null);
const images = ref<IFlashImage[]>([]);

const chipId = ref<string | null>(null);
const flashInfo = ref<{ id: string, size: number } | null>(null);

const flashSize = computed(() => flashInfo.value?.size ?? null);

const status = ref<FlashStatus | null>(null);
const failure = ref<string | null>(null);
const progress = useFlashProgress(images, status);

const busyForInfo = ref(false);
const busyForFlash = computed(() =>
  status.value == FlashStatus.CONNECTING ||
  status.value == FlashStatus.FLASHING ||
  status.value == FlashStatus.VERIFYING);

const readyToFlash = computed(() =>
  selectedPort.value != null &&
  selectedChip.value != null &&
  images.value.length > 0 &&
  !hasError.value);

const message = useMessage();

async function fetchInfo(): Promise<void> {
  chipId.value = null;
  flashInfo.value = null;
  output.value.splice(0);

  try {
    await busyOn(cskburn(selectedPort.value!, BAUDRATE, selectedChip.value!, [], {
      onOutput(line) {
        output.value.push(line);
      },
      onChipId(id) {
        chipId.value = id;
      },
      onFlashId(id, size) {
        flashInfo.value = { id, size };
      },
    }), busyForInfo);

    output.value.push('[获取信息成功]');
  } catch (e) {
    console.error(e);
    message.error('获取信息失败');
    if (e instanceof CSKBurnTerminatedError) {
      output.value.push(`[获取信息失败: 终止信号 ${e.signal}]`);
    } else if (e instanceof CSKBurnUnnormalExitError) {
      if (e.message) {
        output.value.push(`[获取信息失败: ${e.message}]`);
      } else {
        output.value.push(`[获取信息失败: 退出码 ${e.code}]`);
      }
    } else {
      output.value.push(`[获取信息失败: 发生异常 ${e}]`);
    }
  }
}

const hexImage = useHexImage(images);
const partitions = usePartitions(images);

watch(images, () => {
  progress.current = null;
  status.value = null;
  failure.value = null;
});

const errors = computed(() => {
  if (hexImage.value) {
    // For now, we can only roughly compare the total size of all sections
    // against the flash size. The actual end address of the image is unknown,
    // as there's no straightforward way to compute relative offsets from
    // absolute RAM addresses.
    if (flashSize.value != null && hexImage.value.file.size > flashSize.value) {
      return ['超出 Flash 大小'];
    } else {
      return [];
    }
  } else {
    return partitions.value.map((partition, index) => {
      const start = partition.addr;
      const end = start + partition.file.size;

      for (const [otherIndex, other] of partitions.value.entries()) {
        if (otherIndex == index) {
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
  }
});

const hasError = computed(() => errors.value.some((error) => !!error));

const output = ref<string[]>([]);
const outputShown = ref(false);

let aborter: AbortController | undefined;

async function startFlash(): Promise<void> {
  if (images.value.length == 0) {
    return;
  }

  const args = ['--verify-all'];
  if (hexImage.value) {
    args.push(hexImage.value.file.path);
  } else {
    for (const partition of partitions.value) {
      args.push(partition.addr.toString(), partition.file.path);
    }
  }

  aborter = new AbortController();

  progress.current = null;
  output.value.splice(0);
  status.value = FlashStatus.CONNECTING;

  try {
    await cskburn(selectedPort.value!, BAUDRATE, selectedChip.value!, args, {
      signal: aborter.signal,
      onOutput(line) {
        output.value.push(line);
      },
      onChipId(id) {
        chipId.value = id;
      },
      onFlashId(id, size) {
        flashInfo.value = { id, size };
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

    status.value = FlashStatus.SUCCESS;
    output.value.push('[烧录成功]');
  } catch (e) {
    console.error(e);
    if (e instanceof CSKBurnTerminatedError) {
      // @ts-ignore: changed elsewhere
      const stoppedManually = status.value == FlashStatus.STOPPED;
      if (stoppedManually) {
        output.value.push('[烧录停止]');
      } else {
        status.value = FlashStatus.ERROR;
        output.value.push(`[烧录失败: 终止信号 ${e.signal}]`);
      }
    } else if (e instanceof CSKBurnUnnormalExitError) {
      status.value = FlashStatus.ERROR;
      failure.value = e.message;
      output.value.push(`[烧录失败: 退出码 ${e.code}]`);
    } else {
      status.value = FlashStatus.ERROR;
      output.value.push(`[烧录失败: 发生异常 ${e}]`);
    }
  }
}

function stopFlash(): void {
  status.value = FlashStatus.STOPPED;
  aborter?.abort();
}

const setProgressThrottled = throttle({ interval: 500 }, async (progress: number) =>
  await getCurrentWindow().setProgressBar({
    status: ProgressBarStatus.Normal,
    progress,
  }));

watch([progress, status], async () => {
  switch (status.value) {
    case FlashStatus.CONNECTING:
      await getCurrentWindow().setProgressBar({
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
      await getCurrentWindow().setProgressBar({
        status: ProgressBarStatus.None,
      });
      await getCurrentWindow().requestUserAttention(UserAttentionType.Informational);
      break;
    case FlashStatus.ERROR:
      await getCurrentWindow().setProgressBar({
        status: ProgressBarStatus.Error,
      });
      await getCurrentWindow().requestUserAttention(UserAttentionType.Critical);
      break;
  }
});

useListen(() => getCurrentWindow().onCloseRequested(async (event) => {
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

.result {
  font-size: 1.2em;
  font-weight: bold;
  margin-left: 8px;
}
</style>
