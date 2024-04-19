<template>
  <div :class="$style.container">
    <n-select :class="$style.ports" v-model:value="selectedPort" :options="availableSelections" />
    <n-button size="large" secondary round type="primary">开始烧录</n-button>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import {
  NButton,
  NSelect,
  type SelectOption,
} from 'naive-ui';
import { invoke } from '@tauri-apps/api/tauri';
import { useIntervally } from '@/composables/window/useIntervally';

const selectedPort = ref<string | null>(null);
const availablePorts = useIntervally(1000, async () => await invoke('list_ports'));

const availableSelections = computed(() => (availablePorts.value ?? []).map((port) => ({
  label: port,
  value: port,
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
:global(html, body) {
  user-select: none;
}

.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

.ports {
  max-width: 400px;
  margin-bottom: 50px;
}
</style>
