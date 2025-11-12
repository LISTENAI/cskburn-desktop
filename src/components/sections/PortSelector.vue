<template>
  <n-select v-model:value="selectedKey" :options="availableSelections" :consistent-menu-width="false"
    :disabled="props.disabled" placeholder="请选择串口" :style="{ fontFamily: themeVars.fontFamilyMono }">
    <template #empty>
      <n-empty size="small" description="未找到任何串口设备" :show-icon="false" />
    </template>
  </n-select>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { NEmpty, NSelect, useThemeVars, type SelectOption } from 'naive-ui';

import { watchPorts } from '@/utils/serialport';
import { useListen } from '@/composables/tauri/useListen';
import { watchDevices, type IDevice } from '@/utils/adb';

const themeVars = useThemeVars();

const props = defineProps<{
  disabled?: boolean;
}>();

export type IPortSelection = {
  type: 'serial' | 'adb';
} & ({
  type: 'serial';
  path: string;
} | {
  type: 'adb';
  identifier: string;
});

const selectedPort = defineModel<IPortSelection | null>('selected');

const availableSerialPorts = ref<string[]>([]);
useListen(() => watchPorts((ports) => {
  availableSerialPorts.value = ports ?? [];
}));

const availableAdbDevices = ref<IDevice[]>([]);
useListen(() => watchDevices((devices) => {
  availableAdbDevices.value = devices ?? [];
}));

watch([availableSerialPorts, availableAdbDevices], () => {
  const selected = selectedPort.value;
  if (selected?.type === 'serial') {
    if (!availableSerialPorts.value.includes(selected.path)) {
      selectedPort.value = null;
    }
  } else if (selected?.type === 'adb') {
    if (!availableAdbDevices.value.find((d) => d.identifier === selected.identifier)) {
      selectedPort.value = null;
    }
  }
});

const availableSelections = computed(() => [
  ...availableSerialPorts.value.map((port) => ({
    label: `${port} (串口)`,
    value: `serial:${port}`,
    data: { type: 'serial', path: port } satisfies IPortSelection,
    style: { fontFamily: themeVars.value.fontFamilyMono },
  } satisfies SelectOption)),
  ...availableAdbDevices.value.map((device) => ({
    label: `${device.identifier} [${device.state}] (ADB)`,
    value: `adb:${device.identifier}`,
    disabled: device.state != 'DEVICE',
    data: { type: 'adb', identifier: device.identifier } satisfies IPortSelection,
    style: { fontFamily: themeVars.value.fontFamilyMono },
  } satisfies SelectOption)),
]);

const selectedKey = computed({
  get: () => {
    const selected = selectedPort.value;
    if (selected?.type == 'serial') {
      return `serial:${selected.path}`;
    } else if (selected?.type == 'adb') {
      return `adb:${selected.identifier}`;
    }
    return null;
  },
  set: (val: string | null) => {
    const selection = availableSelections.value.find((opt) => opt.value === val);
    selectedPort.value = selection?.data as IPortSelection || null;
  },
});
</script>
