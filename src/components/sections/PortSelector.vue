<template>
  <n-select v-model:value="selectedPort" :options="availableSelections" :consistent-menu-width="false"
    :disabled="isEmpty(availableSelections) || props.disabled" placeholder="空"
    :style="{ fontFamily: themeVars.fontFamilyMono }" />
</template>

<script lang="ts" setup>
import { computed, watch } from 'vue';
import { NSelect, useThemeVars, type SelectOption } from 'naive-ui';
import { isEmpty } from 'radash';
import { invoke } from '@tauri-apps/api/tauri';

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
  if (selectedPort.value) {
    if (!ports?.includes(selectedPort.value)) {
      selectedPort.value = ports?.[0] ?? null;
    }
  } else {
    selectedPort.value = ports?.[0] ?? null;
  }
});
</script>
