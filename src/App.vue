<template>
  <n-flex vertical :class="$style.container" :size="16">
    <n-select :class="$style.port" v-model:value="selectedPort" :options="availableSelections" placeholder="选择一个串口设备" />
    <partition-list :class="$style.partitions" :partitions />
    <n-button :class="$style.footer" size="large" secondary round type="primary" block>
      开始烧录
    </n-button>
  </n-flex>
</template>

<script lang="ts" setup>
import { computed, ref, useCssModule, watch } from 'vue';
import {
  NButton,
  NFlex,
  NSelect,
  type SelectOption,
} from 'naive-ui';
import { invoke } from '@tauri-apps/api/tauri';
import { TauriEvent } from '@tauri-apps/api/event';
import { processFiles, type IPartition } from '@/utils/images';

import { useIntervally } from '@/composables/window/useIntervally';
import { useListen } from '@/composables/tauri/useListen';

import PartitionList from '@/components/PartitionList.vue';

const $style = useCssModule();

const selectedPort = ref<string | null>(null);
const availablePorts = useIntervally(1000, async () => await invoke('list_ports'));

const availableSelections = computed(() => (availablePorts.value ?? []).map((port) => ({
  label: port,
  value: port,
  class: $style.port,
}) as SelectOption));

watch(availablePorts, (ports) => {
  if (selectedPort.value) {
    if (!ports?.includes(selectedPort.value)) {
      selectedPort.value = ports?.[0] ?? null;
    }
  } else {
    selectedPort.value = ports?.[0] ?? null;
  }
});

const partitions = ref<IPartition[]>([]);

useListen<string[]>(TauriEvent.WINDOW_FILE_DROP, async (event) => {
  partitions.value = partitions.value.concat(await processFiles(event.payload));
});
</script>

<style lang="scss" module>
:global(html, body) {
  user-select: none;
}

.container {
  box-sizing: border-box;
  height: 100vh;
  padding: 16px;
}

.port {
  font-family: monospace;
}

.partitions {
  flex: 1 1 auto;
}
</style>
