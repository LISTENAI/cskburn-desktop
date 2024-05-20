import { Command } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';

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
  onError: (error: string) => void;
}>;

export interface ICSKBurnResult {
  code: number | null;
  signal: number | null;
  output: string;
}

export async function cskburn(
  port: string, baud: number, args: string[],
  opts?: ICSKBurnEventHandlers & { signal?: AbortSignal },
): Promise<ICSKBurnResult> {
  return new Promise(async (resolve, reject) => {
    const command = Command.sidecar('cskburn-cli/cskburn', [
      '-s', port,
      '-b', `${baud}`,
      '--chip', '6',
      '--verbose',
      '--chip-id',
      '--probe-timeout', '1000',
      '--reset-attempts', '2',
      '--reset-delay', '100',
      ...args,
    ], { encoding: 'raw' });

    const outputs: string[] = [];

    let currentIndex = 0;

    function handleOutput(output: string) {
      opts?.onOutput?.(output);
      let match: RegExpMatchArray | null = null;
      if (output == 'Waiting for device...') {
        opts?.onWaitingForDevice?.();
      } else if (output == 'Entering update mode...') {
        opts?.onEnteringUpdateMode?.();
      } else if (match = output.match(/^chip\-id: (.+)$/)) {
        opts?.onChipId?.(match[1]);
      } else if (match = output.match(/^flash\-id: (.+)$/)) {
        const flashId = match[1];
        const flashSize = Math.pow(2, parseInt(flashId.substring(4, 6), 16));
        opts?.onFlashId?.(flashId, flashSize);
      } else if (match = output.match(/^Burning partition (\d+)\/(\d+)\.\.\. \((0x.+),/)) {
        currentIndex = parseInt(match[1]) - 1;
        opts?.onPartition?.(currentIndex, parseInt(match[2]), parseInt(match[3], 16));
      } else if (match = output.match(/^(\d+\.\d{2}) KB \/ (\d+\.\d{2}) KB/)) {
        opts?.onProgress?.(currentIndex, parseFloat(match[1]) / parseFloat(match[2]));
      } else if (output.startsWith('Writing took')) {
        opts?.onWrote?.(currentIndex);
      } else if (match = output.match(/^md5 \(.+\): (.+)$/)) {
        opts?.onVerified?.(currentIndex, match[1]);
      } else if (output == 'Resetting...') {
        opts?.onResetting?.();
      } else if (output == 'Finished') {
        opts?.onFinished?.();
      } else if (match = output.match(/^ERROR: (.+)$/)) {
        opts?.onError?.(match[1]);
      }
    }

    command.stdout.on('data', async (data: Uint8Array) => {
      const line = await invoke('decode', { data });
      outputs.push(line);
      handleOutput(line.trim());
    });

    command.stderr.on('data', async (data: Uint8Array) => {
      const line = await invoke('decode', { data });
      outputs.push(line);
      handleOutput(line.trim());
    });

    command.once('close', (data) => {
      resolve({ code: data.code, signal: data.signal, output: outputs.join('') })
    });

    command.once('error', (data) => {
      reject(data);
    });

    const child = await command.spawn();

    opts?.signal?.addEventListener('abort', () => {
      child.kill();
    });
  });
}
