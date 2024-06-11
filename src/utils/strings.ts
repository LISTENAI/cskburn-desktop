import { invoke } from '@tauri-apps/api/core';

export async function decode(data: ArrayLike<number>): Promise<string> {
  // IPC is expensive, so we should avoid it if possible.
  const isPureAscii = Array.from(data).every((c) => c < 0x80);
  if (isPureAscii) {
    return new TextDecoder().decode(new Uint8Array(data));
  }

  return await invoke('decode', { data });
}
