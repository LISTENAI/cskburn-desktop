import { Command, type Child } from '@tauri-apps/plugin-shell';
import PQueue from 'p-queue';

import { decode } from './strings';

type ICSKBurnEventHandlers = Partial<{
  onOutput: (output: string) => void;
  onWaitingForDevice: () => void;
  onEnteringUpdateMode: () => void;
  onChipId: (id: string) => void;
  onFlashId: (id: string, size: number) => void;
  onPartition: (index: number, total: number, addr: number) => void;
  onProgress: (index: number, current: number) => void;
  onWrote: (index: number) => void;
  onVerified: (index: number, md5: string) => void;
  onResetting: () => void;
  onFinished: () => void;
}>;

export interface ICSKBurnResult {
  code: number | null;
  signal: number | null;
  output: string;
}

export class CSKBurnTerminatedError extends Error {
  constructor(readonly signal: number) {
    super();
    this.name = 'CSKBurnTerminatedError';
  }
}

export class CSKBurnUnnormalExitError extends Error {
  constructor(message: string | undefined, readonly code: number) {
    super(message);
    this.name = 'CSKBurnUnnormalExitError';
  }
}

export async function cskburn(
  port: string,
  baud: number,
  chip: string,
  args: string[],
  opts?: ICSKBurnEventHandlers & { signal?: AbortSignal },
): Promise<ICSKBurnResult> {
  return new Promise((resolve, reject) => {
    const command = Command.sidecar('cskburn-cli/cskburn', [
      '-s', port,
      '-b', `${baud}`,
      '--chip', chip,
      '--verbose',
      '--chip-id',
      '--probe-timeout', '1000',
      '--reset-attempts', '2',
      '--reset-delay', '100',
      ...args,
    ], { encoding: 'raw' });

    const queue = new PQueue({ concurrency: 1 });
    const outputs: string[] = [];

    let currentIndex = 0;
    let error: string | undefined;

    function handleOutput(output: string) {
      opts?.onOutput?.(output);
      let match: RegExpMatchArray | null = null;
      if (output == 'Waiting for device...') {
        opts?.onWaitingForDevice?.();
      } else if (output == 'Entering update mode...') {
        opts?.onEnteringUpdateMode?.();
      } else if ((match = output.match(/^chip-id: (.+)$/))) {
        opts?.onChipId?.(match[1]);
      } else if ((match = output.match(/^flash-id: (.+)$/))) {
        const flashId = match[1];
        const flashSize = Math.pow(2, parseInt(flashId.substring(4, 6), 16));
        opts?.onFlashId?.(flashId, flashSize);
      } else if ((match = output.match(/^Burning partition (\d+)\/(\d+)\.\.\. \((0x.+),/))) {
        currentIndex = parseInt(match[1]) - 1;
        opts?.onPartition?.(currentIndex, parseInt(match[2]), parseInt(match[3], 16));
      } else if ((match = output.match(/^(\d+\.\d{2}) KB \/ (\d+\.\d{2}) KB/))) {
        opts?.onProgress?.(currentIndex, parseFloat(match[1]) / parseFloat(match[2]));
      } else if (output.startsWith('Writing took')) {
        opts?.onWrote?.(currentIndex);
      } else if ((match = output.match(/^md5 \(.+\): (.+)$/))) {
        opts?.onVerified?.(currentIndex, match[1]);
      } else if (output == 'Resetting...') {
        opts?.onResetting?.();
      } else if (output == 'Finished') {
        opts?.onFinished?.();
      } else if ((match = output.match(/^ERROR: (.+)$/))) {
        error = match[1];
      }
    }

    function handleData(data: Uint8Array) {
      queue.add(async () => {
        for (const line of (await decode(data)).trim().split('\n')) {
          outputs.push(line);
          handleOutput(line.trim());
        }
      });
    }

    command.stdout.on('data', handleData);
    command.stderr.on('data', handleData);

    command.once('close', async ({ code, signal }) => {
      await queue.onIdle();
      if (signal != null) {
        reject(new CSKBurnTerminatedError(signal));
      } else if (code !== 0) {
        reject(new CSKBurnUnnormalExitError(error, code ?? -1));
      } else {
        resolve({ code, signal, output: outputs.join('') })
      }
    });

    command.once('error', (data) => {
      queue.clear();
      reject(data);
    });

    let child: Child | undefined;

    command.spawn()
      .then((c) => child = c)
      .catch((err) => reject(err));

    opts?.signal?.addEventListener('abort', () => {
      child?.kill();
    });
  });
}
