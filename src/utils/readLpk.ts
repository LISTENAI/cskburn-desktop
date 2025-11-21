import { invoke } from '@tauri-apps/api/core';
import { plainToInstance } from 'class-transformer';

import { TmpFile } from './file';
import type { IPartition } from './images';

export interface ILpkInfo {
  chip: string;
  partitions: IPartition[];
}

export async function readLpk(path: string): Promise<ILpkInfo> {
  const { chip, partitions } = await invoke('read_lpk', { path });
  return {
    chip,
    partitions: partitions.map((part) => ({
      addr: part.addr,
      file: plainToInstance(TmpFile, { ...part.file, containerPath: path }),
    })),
  };
}
