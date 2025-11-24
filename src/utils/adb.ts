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

export async function executeShell(identifier: string, commands: string[]): Promise<string> {
  return await invoke('adb_shell', { identifier, commands });
}

export async function fetchChipId(identifier: string): Promise<string | null> {
  const output = await executeShell(identifier, ['info', 'sn']);
  const match = output.match(/serial num: ([0-9A-F]+)/i);
  return match?.[1].toUpperCase() ?? null;
}

export async function fetchFlashSize(identifier: string): Promise<number | null> {
  const output = await executeShell(identifier, ['info', 'flash']);
  const match = output.match(/size: (\d+)MB/);
  return match ? (parseInt(match[1], 10) * 1024 * 1024) : null;
}

export type ITransferEvent = {
  type: 'PROGRESS';
  data: { readSize: number; totalSize: number };
} | {
  type: 'COMPLETED';
} | {
  type: 'ERROR';
  data: { message: string };
};

export class ADBTransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ADBTransferError';
  }
}

export class ADBTransferCancelledError extends Error {
  constructor() {
    super('ADB transfer cancelled');
    this.name = 'ADBTransferCancelledError';
  }
}

export async function pushFile(
  identifier: string,
  local: string,
  remote: string,
  onProgress: (read: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();

  const onEvent = new Channel<ITransferEvent>();
  onEvent.onmessage = (event) => {
    switch (event.type) {
      case 'PROGRESS': {
        const { readSize, totalSize } = event.data;
        onProgress(readSize, totalSize);
        break;
      }
      case 'COMPLETED': {
        resolve();
        break;
      }
      case 'ERROR': {
        const { message } = event.data;
        if (message == 'cancelled') {
          reject(new ADBTransferCancelledError());
        } else {
          reject(new ADBTransferError(message));
        }
        break;
      }
    }
  };

  if (signal) {
    signal.addEventListener('abort', () => {
      void invoke('adb_push_cancel', { rid });
    });
  }

  const rid = await invoke('adb_push', {
    identifier,
    local,
    remote,
    onEvent,
  });

  return promise;
}
