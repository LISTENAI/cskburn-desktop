<template>
  <n-select v-model:value="selectedPort" :options="availableSelections" :consistent-menu-width="false"
    :disabled="props.disabled" placeholder="请选择串口" :style="{ fontFamily: themeVars.fontFamilyMono }">
    <template #empty>
      <n-empty size="small" description="未找到任何串口设备" :show-icon="false" />
    </template>
  </n-select>
</template>

<script lang="ts" setup>
import { computed, watch } from 'vue';
import { NEmpty, NSelect, useThemeVars, type SelectOption } from 'naive-ui';
import { invoke } from '@tauri-apps/api/core';

import { useIntervally } from '@/composables/window/useIntervally';

const themeVars = useThemeVars();

const props = defineProps<{
  disabled?: boolean;
}>();

const selectedPort = defineModel<string | null>('port');

const availablePorts = useIntervally(1000, async () => await invoke('list_ports'));

const availableSelections = computed(() => (availablePorts.value ?? []).map((port) => ({
  label: port,
  value: port,
  style: { fontFamily: themeVars.value.fontFamilyMono },
}) as SelectOption));

watch(availablePorts, (ports) => {
  if (selectedPort.value && !ports?.includes(selectedPort.value)) {
    selectedPort.value = null;
  }
});
</script>
