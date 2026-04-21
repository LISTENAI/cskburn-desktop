import { appCacheDir, basename, join } from '@tauri-apps/api/path';
import { remove, stat } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { sum } from 'radash';
import { plainToInstance, Type } from 'class-transformer';

import { UserError } from '@/userError';

import type { IPartition } from './images';
import { inspectLpk } from './readLpk';
import { inspectHex, type ISection } from './readHex';
import { revealFile } from './revealFile';

const TEMP_DIR = 'unpacked';

export interface IFileRef {
  /**
   * Real path of the file on the disk. May be empty for refs that only carry
   * metadata (e.g. a partition inside an LPK that hasn't been extracted yet).
   */
  path: string;

  /**
   * Display name of the file.
   */
  name: string;

  /**
   * Size of the file in bytes.
   */
  size: number;

  /**
   * Time of the last modification of the file.
   */
  mtime: Date;

  /**
   * Reveal the file in the file manager.
   */
  reveal(): Promise<void>;
}

export async function cleanUpTmpFiles(): Promise<void> {
  const tmpDir = await join(await appCacheDir(), TEMP_DIR);
  try {
    await remove(tmpDir, { recursive: true });
  } catch {
    // do nothing
  }
}

export async function computeMd5(path: string): Promise<string> {
  return (await invoke('md5', { path })).toLowerCase();
}

abstract class BaseFile implements IFileRef {
  readonly path!: string;
  readonly name!: string;
  readonly size!: number;
  @Type(() => Date) readonly mtime!: Date;

  async reveal(): Promise<void> {
    await revealFile(this.path);
  }
}

export class LocalFile extends BaseFile {
  static async from(path: string): Promise<LocalFile> {
    const name = await basename(path);
    const { size, mtime } = await stat(path);
    return plainToInstance(LocalFile, { path, name, size, mtime: mtime! });
  }
}

export class HexFile extends BaseFile {
  sections!: ISection[];

  static async from(path: string): Promise<HexFile> {
    const name = await basename(path);
    const { mtime } = await stat(path);

    let sections: ISection[];
    try {
      sections = await inspectHex(path);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new UserError('HEX 文件解析失败', detail);
    }

    const size = sum(sections, (section) => section.file.size);
    return plainToInstance(HexFile, {
      path,
      name,
      size,
      mtime: mtime!,
      sections,
    });
  }
}

export class LpkFile extends BaseFile {
  chip!: string;
  partitions!: IPartition[];

  static async from(path: string): Promise<LpkFile> {
    const name = await basename(path);
    const { size, mtime } = await stat(path);
    const { chip, partitions } = await inspectLpk(path);
    return plainToInstance(LpkFile, { path, name, size, mtime: mtime!, chip, partitions });
  }
}

export class PendingFile extends BaseFile {
  readonly containerPath!: string;
  readonly md5?: string;

  async reveal(): Promise<void> {
    await revealFile(this.containerPath);
  }
}

export class TmpFile extends BaseFile {
  readonly containerPath?: string;

  async reveal(): Promise<void> {
    await revealFile(this.containerPath ?? this.path);
  }
}
