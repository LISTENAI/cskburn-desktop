import { appCacheDir, basename, join } from '@tauri-apps/api/path';
import { mkdir, readFile, remove, stat, writeFile } from '@tauri-apps/plugin-fs';
import { sum } from 'radash';
import { plainToInstance, Type } from 'class-transformer';
import pMap from 'p-map';

import type { IPartition } from './images';
import { readLpk } from './readLpk';
import { readHex, type ISection } from './readHex';
import { revealFile } from './revealFile';

const TEMP_DIR = 'unpacked';

export interface IFileRef {
  /**
   * Real path of the file on the disk.
   */
  path: string;

  /**
   * Path of the container file (for example, a .lpk file) that this file is
   * extracted from (if any).
   */
  containerPath?: string;

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
   * Read the content of the file.
   */
  content(): Promise<Uint8Array>;

  /**
   * Reveal the file in the file manager.
   */
  reveal(): Promise<void>;

  /**
   * Free any resources associated with the file.
   */
  free: () => Promise<void>;
}

export async function cleanUpTmpFiles(): Promise<void> {
  const tmpDir = await join(await appCacheDir(), TEMP_DIR);
  try {
    await remove(tmpDir, { recursive: true });
  } catch {
    // do nothing
  }
}

async function ensureTmpDir(): Promise<string> {
  const tmpDir = await join(await appCacheDir(), TEMP_DIR);
  await mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

function generateTmpFileName(): string {
  return `${Math.random().toString(36).substring(2)}.bin`;
}

abstract class BaseFile implements IFileRef {
  readonly path!: string;
  readonly name!: string;
  readonly size!: number;
  @Type(() => Date) readonly mtime!: Date;

  async content(): Promise<Uint8Array> {
    return await readFile(this.path);
  }

  async reveal(): Promise<void> {
    await revealFile(this.path);
  }

  async free(): Promise<void> {
    // do nothing
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
  readonly sections!: ISection[];

  static async from(path: string): Promise<HexFile> {
    const name = await basename(path);
    const { mtime } = await stat(path);
    const sections = await readHex(path);
    const size = sum(sections, (section) => section.size);
    return plainToInstance(HexFile, { path, name, size, mtime: mtime!, sections });
  }
}

export class LpkFile extends BaseFile {
  readonly partitions!: IPartition[];

  static async from(path: string): Promise<LpkFile> {
    const name = await basename(path);
    const { size, mtime } = await stat(path);
    const partitions = await readLpk(path);
    return plainToInstance(LpkFile, { path, name, size, mtime: mtime!, partitions });
  }

  async free(): Promise<void> {
    await pMap(this.partitions, async (part) => await part.file.free());
  }
}

export class TmpFile extends BaseFile {
  readonly containerPath?: string;

  static async from(pseudoPath: string, content: Uint8Array, mtime: Date, containerPath?: string): Promise<TmpFile> {
    const tmpDir = await ensureTmpDir();

    const path = await join(tmpDir, generateTmpFileName());
    const name = await basename(pseudoPath);

    await writeFile(path, content);

    return plainToInstance(TmpFile, { path, name, size: content.length, mtime, containerPath });
  }

  async reveal(): Promise<void> {
    await revealFile(this.containerPath ?? this.path);
  }

  async free(): Promise<void> {
    await remove(this.path);
  }
}
