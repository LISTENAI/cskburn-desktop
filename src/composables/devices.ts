import { ref, type Ref } from 'vue';

import { watchPorts } from '@/utils/serialport';
import { watchDevices, type IDevice } from '@/utils/adb';

import { useListen } from './tauri/useListen';

export function useAvailableSerialPorts(): Readonly<Ref<string[]>> {
  const ports = ref<string[]>([]);
  useListen(() => watchPorts((newPorts) => {
    ports.value = newPorts ?? [];
  }));
  return ports;
}

export function useAvailableAdbDevices(): Readonly<Ref<IDevice[]>> {
  const devices = ref<IDevice[]>([]);
  useListen(() => watchDevices((newDevices) => {
    devices.value = newDevices ?? [];
  }));
  return devices;
}
