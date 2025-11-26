import { Command } from '@tauri-apps/plugin-shell';

type UnwatchFn = () => void;

export interface IDevice {
  identifier: string;
  state: IDeviceState;
  properties: Record<string, string>;
}

export type IDeviceState =
  'OFFLINE' |
  'DEVICE' |
  'RECOVERY';

export async function listDevices(): Promise<IDevice[]> {
  const { stdout } = await Command.create('adb', ['devices', '-l']).execute();
  return stdout.split('\n').reduce<IDevice[]>((devices, line) => {
    const [, identifier, state, props] = line.trim().match(/^(\S+)\s+(\S+)\s(.+)$/) ?? [];
    if (!identifier || !state || !props) {
      return devices;
    }

    if (state != 'device') {
      return devices;
    }

    const properties = props.split(' ').reduce<Record<string, string>>((acc, prop) => {
      const [key, value] = prop.split(':');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});

    devices.push({
      identifier,
      state: identifier.startsWith('BOOT-') ? 'RECOVERY' : 'DEVICE',
      properties,
    });

    return devices;
  }, []);
}

export async function watchDevices(cb: (devices: IDevice[]) => void): Promise<UnwatchFn> {
  const timer = setInterval(async () => {
    const devices = await listDevices();
    cb(devices);
  }, 2000);

  cb(await listDevices());

  return () => clearInterval(timer);
}

async function executeShell(identifier: string, commands: string[]): Promise<string> {
  const { stdout } = await Command.create('adb', ['-s', identifier, 'shell', ...commands]).execute();
  return stdout;
}

export async function rebootToRecovery(identifier: string): Promise<void> {
  try {
    await executeShell(identifier, ['recovery']);
  } catch {
    // 忽略，因为设备必然会断开连接
  }
}
