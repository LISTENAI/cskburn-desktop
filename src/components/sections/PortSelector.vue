<template>
  <n-select v-model:value="selectedPort" :options="availableSelections" :consistent-menu-width="false"
    :disabled="props.disabled" placeholder="请选择串口" :style="{ fontFamily: themeVars.fontFamilyMono }">
    <template #empty>
      <n-empty size="small" description="未找到任何串口设备" :show-icon="false" />
    </template>
  </n-select>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { NEmpty, NSelect, useThemeVars, type SelectOption } from 'naive-ui';

import { watchPorts } from '@/utils/serialport';
import { useListen } from '@/composables/tauri/useListen';

const themeVars = useThemeVars();

const props = defineProps<{
  disabled?: boolean;
}>();

const selectedPort = defineModel<string | null>('port');

const availablePorts = ref<string[]>();

useListen(() => watchPorts((ports) => {
  availablePorts.value = ports;

  if (selectedPort.value && !ports?.includes(selectedPort.value)) {
    selectedPort.value = null;
  }
}));

const availableSelections = computed(() => (availablePorts.value ?? []).map((port) => ({
  label: port,
  value: port,
  style: { fontFamily: themeVars.value.fontFamilyMono },
}) as SelectOption));
</script>
