import { appCacheDir, basename, join } from '@tauri-apps/api/path';
import { mkdir, readFile, remove, stat, writeFile, watch as watchFile, type UnwatchFn, exists } from '@tauri-apps/plugin-fs';
import { plainToInstance, Type } from 'class-transformer';

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
   * Whether the file exists or not.
   */
  existed: boolean;

  /**
   * Watch the file for changes.
   */
  startWatch(): Promise<UnwatchFileFn>;

  /**
   * Read the content of the file.
   */
  content(): Promise<Uint8Array>;

  /**
   * Free any resources associated with the file.
   */
  free: () => Promise<void>;
}

export async function cleanUpTmpFiles(): Promise<void> {
  const tmpDir = await join(await appCacheDir(), TEMP_DIR);
  try {
    await remove(tmpDir, { recursive: true });
  } catch (e) {
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

export type UnwatchFileFn = () => void;

abstract class BaseFile implements IFileRef {
  readonly path!: string;
  readonly name!: string;
  size!: number;
  @Type(() => Date) mtime!: Date;

  private unwatchFn?: UnwatchFn;
  existed = true;

  async startWatch(): Promise<UnwatchFileFn> {
    if (!(await exists(this.path))) {
      throw new Error(`File ${this.path} does not exist`);
    }
    this.unwatchFn?.();
    this.unwatchFn = await watchFile(this.path, async (ev) => {
      if ('modify' in (ev.type as any) || 'create' in (ev.type as any)) {
        const newStat = await stat(this.path);
        this.mtime = newStat.mtime!;
        this.size = newStat.size;
        this.existed = true;
      } else if ('remove' in (ev.type as any)) {
        this.existed = false;
      }
    });
    return this.unwatchFn;
  }

  async content(): Promise<Uint8Array> {
    return await readFile(this.path);
  }

  async free(): Promise<void> {
    this.unwatchFn?.();
  }
}

export class LocalFile extends BaseFile {
  static async from(path: string): Promise<LocalFile> {
    const name = await basename(path);
    const { size, mtime } = await stat(path);
    return plainToInstance(LocalFile, { path, name, size, mtime: mtime! });
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

  async free(): Promise<void> {
    await remove(this.path);
  }
}
