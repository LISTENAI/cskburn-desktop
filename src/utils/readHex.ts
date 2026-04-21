import { invoke } from '@tauri-apps/api/core';
import { plainToInstance } from 'class-transformer';

import { PendingFile, TmpFile, type IFileRef } from './file';

export interface ISection {
  address: number;
  file: IFileRef;
  enabled: boolean;
}

export interface IHexSectionMeta {
  address: number;
  name: string;
  size: number;
  mtime: number;
}

export interface IHexMeta {
  sections: IHexSectionMeta[];
}

export interface IExtractedSectionRaw {
  address: number;
  file: {
    path: string;
    name: string;
    size: number;
    mtime: number;
  };
}

export async function inspectHex(path: string): Promise<ISection[]> {
  const { sections } = await invoke('inspect_hex', { path });
  return sections.map((section) => ({
    address: section.address,
    file: plainToInstance(PendingFile, {
      path: '',
      containerPath: path,
      name: section.name,
      size: section.size,
      mtime: section.mtime,
    }),
    enabled: true,
  }));
}

export async function extractHex(path: string): Promise<ISection[]> {
  const extracted = await invoke('extract_hex', { path });
  return extracted.map((section) => ({
    address: section.address,
    file: plainToInstance(TmpFile, {
      ...section.file,
      containerPath: path,
    }),
    enabled: true,
  }));
}
