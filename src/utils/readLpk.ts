import { invoke } from '@tauri-apps/api/core';
import { plainToInstance } from 'class-transformer';

import { TmpFile } from './file';
import type { IPartition } from './images';

export async function readLpk(path: string): Promise<IPartition[]> {
  const partitions = await invoke('read_lpk', { path });
  return partitions.map((part) => ({
    addr: part.addr,
    file: plainToInstance(TmpFile, { ...part.file, containerPath: path }),
  }));
}
