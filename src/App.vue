<template>
  <n-flex vertical :size="16" :style="{
    boxSizing: 'border-box',
    height: '100vh',
    padding: '16px'
  }">
    <auto-updater />

    <n-flex align="center">
      <div>端口:</div>
      <port-selector v-model:port="selectedPort" :disabled="busyForInfo || busyForFlash"
        :style="{ flex: '0 1 300px' }" />
    </n-flex>

    <n-flex align="center">
      <n-element :class="$style.info" :style="{ width: '16em' }">
        Chip ID: <selectable-text selectable>{{ chipId || 'N/A' }}</selectable-text>
      </n-element>
      <n-element :class="$style.info" :style="{ width: '16em' }">
        Flash ID: <selectable-text selectable>{{ flashInfo || 'N/A' }}</selectable-text>
      </n-element>
      <n-button secondary size="small" :disabled="selectedPort == null || busyForFlash" :loading="busyForInfo"
        @click="fetchInfo">
        获取
      </n-button>
    </n-flex>

    <partition-view v-model:image="image" :busy="busyForFlash" :progress="progressTable" :errors
      :style="{ flex: '1 1 auto' }" />

    <n-flex align="center" :size="32">
      <n-flex align="center" :style="{ width: 'auto', flex: '1 1 auto' }">
        <template v-if="status == FlashStatus.CONNECTING">
          <n-spin size="small" />
        </template>
        <template v-else-if="status == FlashStatus.FLASHING">
          <n-progress type="line" :percentage="progressPct" :show-indicator="false" />
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
          <n-button secondary round size="small" @click="() => outputShown = !outputShown">
            查看日志
          </n-button>
        </template>
      </n-flex>

      <n-button v-if="busyForFlash" size="large" :style="{ flex: '0 0 140px' }" @click="stopFlash">
        停止
      </n-button>
      <n-button v-else size="large" type="primary" :disabled="!readyToFlash || busyForInfo"
        :style="{ flex: '0 0 140px' }" @click="startFlash">
        开始烧录
      </n-button>
    </n-flex>

    <n-element v-if="outputShown" :style="{ height: '200px' }">
      <n-input type="textarea" :value="output" placeholder="" readonly :resizable="false"
        :style="{ height: '100%', fontFamily: 'var(--font-family-mono)' }" />
    </n-element>
  </n-flex>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import {
  NButton,
  NElement,
  NFlex,
  NInput,
  NProgress,
  NSpin,
  NText,
} from 'naive-ui';
import { imageSize, type IFlashImage } from '@/utils/images';
import { cskburn } from '@/utils/cskburn';

import { busyOn } from '@/composables/busyOn';

import AutoUpdater from '@/components/sections/AutoUpdater.vue';
import PortSelector from '@/components/sections/PortSelector.vue';
import PartitionView, { type IProgress } from '@/components/sections/PartitionView.vue';

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

enum FlashStatus {
  CONNECTING,
  FLASHING,
  STOPPED,
  SUCCESS,
  ERROR,
}

const status = ref<null | FlashStatus>(null);
const busyForInfo = ref(false);
const busyForFlash = computed(() => status.value == FlashStatus.CONNECTING || status.value == FlashStatus.FLASHING);

const readyToFlash = computed(() => selectedPort.value != null && image.value != null && !hasError.value);

async function fetchInfo(): Promise<void> {
  chipId.value = null;
  flashId.value = null;
  flashSize.value = null;

  await busyOn(cskburn(selectedPort.value!, 1500000, [], {
    onChipId(id) {
      chipId.value = id;
    },
    onFlashId(id, size) {
      flashId.value = id;
      flashSize.value = size;
    },
  }), busyForInfo);
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

const output = ref('');
const outputShown = ref(false);

const progress = ref<{ index: number, current: number } | null>(null);

watch(image, () => {
  progress.value = null;
  status.value = null;
});

const progressTable = computed<IProgress | null>(() => {
  if (progress.value == null) {
    return null;
  }

  const state = ((): IProgress['state'] => {
    switch (status.value) {
      case FlashStatus.STOPPED:
        return 'stopped';
      case FlashStatus.ERROR:
        return 'error';
      default:
        return 'progress';
    }
  })();

  return { ...progress.value, state };
});

const progressPct = computed(() => {
  if (image.value == null || progress.value == null) {
    return 0;
  }

  if (image.value.format == 'bin') {
    const total = imageSize(image.value);
    const wrote = imageSize(image.value, progress.value.index);
    const current = image.value.partitions[progress.value.index].file.size * progress.value.current;
    return (wrote + current) / total * 100;
  } else if (image.value.format == 'hex') {
    const total = imageSize(image.value);
    const wrote = imageSize(image.value, progress.value.index);
    const current = image.value.sections[progress.value.index].size * progress.value.current;
    return (wrote + current) / total * 100;
  }
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

  progress.value = null;
  outputShown.value = false;
  status.value = FlashStatus.CONNECTING;

  // Workaround for cskburn bug that invalid addresses won't cause non-zero exit,
  // while probing retries prints `ERROR:`.
  let mayHaveError = false;

  const result = await cskburn(selectedPort.value!, 1500000, args, {
    signal: aborter.signal,
    onChipId(id) {
      chipId.value = id;
    },
    onFlashId(id, size) {
      flashId.value = id;
      flashSize.value = size;
    },
    onPartition(index, _total, _addr) {
      progress.value = { index, current: 0 };
      status.value = FlashStatus.FLASHING;
    },
    onProgress(index, current) {
      progress.value = { index, current };
    },
    onError(_error) {
      mayHaveError = true;
    },
    onFinished() {
      mayHaveError = false;
    },
  });

  output.value = result.output;
  status.value = (result.code == 0 && !mayHaveError) ? FlashStatus.SUCCESS : FlashStatus.ERROR;
}

function stopFlash(): void {
  status.value = FlashStatus.STOPPED;
  aborter?.abort();
}
</script>

<style lang="scss" module>
:global(html, body) {
  user-select: none;
  cursor: default;
}

.info {
  font-family: var(--font-family-mono);
}

.result {
  font-size: 1.2em;
  font-weight: bold;
  margin-left: 8px;
}
</style>
