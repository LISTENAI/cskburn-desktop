import { invoke } from '@tauri-apps/api/core';

export interface ISection {
  address: number;
  size: number;
}

export async function readHex(path: string): Promise<ISection[]> {
  return await invoke('read_hex', { path });
}
