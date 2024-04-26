<template>
  <n-select v-model:value="selectedPort" :options="availableSelections" :consistent-menu-width="false"
    :disabled="isEmpty(availableSelections) || props.disabled" placeholder="空" :class="$style.port" />
</template>

<script lang="ts" setup>
import { computed, useCssModule, watch } from 'vue';
import { NSelect, type SelectOption } from 'naive-ui';
import { isEmpty } from 'radash';
import { invoke } from '@tauri-apps/api/tauri';

import { useIntervally } from '@/composables/window/useIntervally';

const $style = useCssModule();

const props = defineProps<{
  disabled?: boolean;
}>();

const selectedPort = defineModel<string | null>('port');

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
</script>

<style lang="scss" module>
.port {
  font-family: monospace;
}
</style>
