import { appCacheDir, basename, join } from '@tauri-apps/api/path';
import { mkdir, readFile, remove, stat, writeFile } from '@tauri-apps/plugin-fs';

const TEMP_DIR = 'unpacked';

export interface IFileRef {
  /**
   * Real path of the file on the disk.
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

class BaseFile implements IFileRef {
  constructor(
    readonly path: string,
    readonly name: string,
    readonly size: number) {
  }

  async content(): Promise<Uint8Array> {
    return await readFile(this.path);
  }

  async free(): Promise<void> {
    // do nothing
  }
}

export class LocalFile extends BaseFile {
  static async from(path: string): Promise<LocalFile> {
    const name = await basename(path);
    const { size } = await stat(path);
    return new LocalFile(path, name, size);
  }

  private constructor(path: string, name: string, size: number) {
    super(path, name, size);
  }
}

export class TmpFile extends BaseFile {
  static async from(pseudoPath: string, content: Uint8Array): Promise<TmpFile> {
    const tmpDir = await ensureTmpDir();

    const path = await join(tmpDir, generateTmpFileName());
    const name = await basename(pseudoPath);

    await writeFile(path, content);

    return new TmpFile(path, name, content.length);
  }

  static clone(base: TmpFile): TmpFile {
    return new TmpFile(base.path, base.name, base.size);
  }

  private constructor(path: string, name: string, size: number) {
    super(path, name, size);
  }

  async free(): Promise<void> {
    await remove(this.path);
  }
}
