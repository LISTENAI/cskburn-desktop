import { invoke } from '@tauri-apps/api/core';
import { plainToInstance } from 'class-transformer';

import { TmpFile, type IFileRef } from './file';

export interface ISection {
  address: number;
  file: IFileRef;
  enabled: boolean;
}

export async function readHex(path: string): Promise<ISection[]> {
  const sections = await invoke('read_hex', { path });
  return sections.map((section) => ({
    address: section.address,
    file: plainToInstance(TmpFile, { ...section.file, containerPath: path }),
    enabled: true,
  }));
}
