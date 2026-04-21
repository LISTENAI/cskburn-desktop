import { Child, Command } from '@tauri-apps/plugin-shell';

type UnwatchFn = () => void;

const TRACK_DEVICES_RETRY_INTERVAL = 2_000;

export async function checkVersion(): Promise<string> {
  const { stdout } = await Command.create('adb', ['version']).execute();
  const match = stdout.match(/Android Debug Bridge version (.+)/);
  return match ? match[1] : 'unknown';
}

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

    if (state !== 'device') {
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
  try {
    cb(await listDevices());
  } catch (e) {
    cb([]);
    console.warn('Failed to list ADB devices:', e);
    return () => { };
  }

  let stopped = false;
  let child: Child | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshing = false;
  let pending = false;

  async function refresh() {
    if (refreshing) {
      pending = true;
      return;
    }
    refreshing = true;
    try {
      do {
        pending = false;
        const devices = await listDevices();
        if (stopped) return;
        cb(devices);
      } while (pending && !stopped);
    } catch (e) {
      console.warn('Failed to list ADB devices:', e);
      if (!stopped) cb([]);
    } finally {
      refreshing = false;
    }
  }

  function start() {
    if (stopped) return;

    const command = Command.create('adb', ['track-devices']);

    command.stdout.on('data', () => { void refresh(); });
    command.stderr.on('data', (data) => {
      console.warn('adb track-devices stderr:', data);
    });

    command.once('close', () => {
      child = undefined;
      if (!stopped) {
        retryTimer = setTimeout(start, TRACK_DEVICES_RETRY_INTERVAL);
      }
    });

    command.once('error', (err) => {
      console.warn('adb track-devices error:', err);
    });

    command.spawn()
      .then((c) => {
        if (stopped) {
          void c.kill();
        } else {
          child = c;
        }
      })
      .catch((err) => {
        console.warn('Failed to spawn adb track-devices:', err);
        if (!stopped) {
          retryTimer = setTimeout(start, TRACK_DEVICES_RETRY_INTERVAL);
        }
      });
  }

  start();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    if (child) {
      void child.kill();
      child = undefined;
    }
  };
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

export async function rebootToSystem(identifier: string): Promise<void> {
  try {
    await executeShell(identifier, ['reboot', 'hard']);
  } catch {
    // 忽略，因为设备必然会断开连接
  }
}

export async function computeMd5(identifier: string, remote: string): Promise<string | undefined> {
  const output = await executeShell(identifier, ['md5sum', remote]);
  const [, md5sum, path] = output.match(/([a-fA-F0-9]{32})\s+(\S+)/) ?? [];
  return md5sum && path === remote ? md5sum.toLowerCase() : undefined;
}

export async function fetchChipId(identifier: string): Promise<string | null> {
  const output = await executeShell(identifier, ['info', 'sn']);
  const match = output.match(/serial num: ([0-9A-F]+)/i);
  return match?.[1] ?? null;
}

export async function fetchFlashSize(identifier: string): Promise<number | null> {
  const output = await executeShell(identifier, ['info', 'flash']);
  const match = output.match(/size: (\d+)MB/);
  return match ? (parseInt(match[1], 10) * 1024 * 1024) : null;
}

type IADBTransferEventHandlers = Partial<{
  onOutput: (output: string) => void;
}>;

export class ADBTransferTerminatedError extends Error {
  constructor(readonly signal: number) {
    super();
    this.name = 'ADBTransferTerminatedError';
  }
}

export class ADBTransferUnnormalExitError extends Error {
  constructor(message: string | undefined, readonly code: number) {
    super(message);
    this.name = 'ADBTransferUnnormalExitError';
  }
}

export function pushFile(
  identifier: string,
  local: string,
  remote: string,
  opts?: IADBTransferEventHandlers & { signal?: AbortSignal },
): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();

  const command = Command.create('adb', ['-s', identifier, 'push', local, remote]);

  function handleOutput(output: string) {
    opts?.onOutput?.(output);
  }

  function handleData(data: string) {
    for (const line of data.split('\n')) {
      handleOutput(line);
    }
  }

  command.stdout.on('data', handleData);
  command.stderr.on('data', handleData);

  command.once('close', ({ code, signal }) => {
    if (signal != null) {
      reject(new ADBTransferTerminatedError(signal));
    } else if (code !== 0) {
      reject(new ADBTransferUnnormalExitError(`adb push exited with code ${code}`, code!));
    } else {
      resolve();
    }
  });

  command.once('error', (err) => {
    reject(err);
  });

  let child: Child | undefined;

  command.spawn()
    .then((c) => child = c)
    .catch((err) => reject(err));

  opts?.signal?.addEventListener('abort', () => {
    child?.kill();
  });

  return promise;
}
