import { invoke } from '@tauri-apps/api/core';
import { plainToInstance } from 'class-transformer';

import { PendingFile, TmpFile } from './file';
import type { IPartition } from './images';

export interface ILpkPartitionMeta {
  addr: number;
  name: string;
  size: number;
  mtime: number;
  md5: string;
}

export interface ILpkMeta {
  chip: string;
  partitions: ILpkPartitionMeta[];
}

export interface IExtractedPartitionRaw {
  addr: number;
  file: {
    path: string;
    name: string;
    size: number;
    mtime: number;
  };
}

export interface ILpkInfo {
  chip: string;
  partitions: IPartition[];
}

export async function inspectLpk(path: string): Promise<ILpkInfo> {
  const { chip, partitions } = await invoke('inspect_lpk', { path });
  return {
    chip,
    partitions: partitions.map((part) => ({
      addr: part.addr,
      file: plainToInstance(PendingFile, {
        path: '',
        containerPath: path,
        name: part.name,
        size: part.size,
        mtime: part.mtime,
        md5: part.md5,
      }),
      enabled: true,
    })),
  };
}

export async function extractLpk(path: string): Promise<IPartition[]> {
  const extracted = await invoke('extract_lpk', { path });
  return extracted.map((part) => ({
    addr: part.addr,
    file: plainToInstance(TmpFile, {
      ...part.file,
      containerPath: path,
    }),
    enabled: true,
  }));
}
