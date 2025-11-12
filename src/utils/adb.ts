import { invoke, Channel } from '@tauri-apps/api/core';

type UnwatchFn = () => void;

export interface IDevice {
  identifier: string;
  state: IDeviceState;
}

export type IDeviceState =
  'OFFLINE' |
  'DEVICE' |
  'NO_DEVICE' |
  'AUTHORIZING' |
  'UNAUTHORIZED' |
  'CONNECTING' |
  'NO_PERM' |
  'DETACHED' |
  'BOOTLOADER' |
  'HOST' |
  'RECOVERY' |
  'SIDELOAD' |
  'RESCUE';

export async function listDevices(): Promise<IDevice[]> {
  return await invoke('adb_list_devices');
}

export async function watchDevices(cb: (devices: IDevice[]) => void): Promise<UnwatchFn> {
  const onEvent = new Channel<IDevice[]>();
  onEvent.onmessage = cb;

  const rid = await invoke('adb_watch_devices', {
    onEvent: onEvent,
  });

  return () => {
    void invoke('adb_unwatch_devices', { rid });
  };
}
