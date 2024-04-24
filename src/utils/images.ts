import { metadata } from 'tauri-plugin-fs-extra-api';
import { basename } from '@tauri-apps/api/path';

export interface IPartition {
  addr: number;
  file: IFileRef;
}

export interface IFileRef {
  path: string;
  name: string;
  size: number;
  free: () => Promise<void>;
}

export async function processFiles(paths: string[]): Promise<IPartition[]> {
  const partitions: IPartition[] = [];

  for (const path of paths) {
    partitions.push({
      addr: 0,
      file: await LocalBinFile.from(path),
    });
  }

  return partitions;
}

class LocalBinFile implements IFileRef {
  static async from(path: string): Promise<LocalBinFile> {
    const name = await basename(path);
    const { size } = await metadata(path);
    return new LocalBinFile(path, name, size);
  }

  private constructor(
    readonly path: string,
    readonly name: string,
    readonly size: number) {
  }

  async free(): Promise<void> {
    // do nothing
  }
}
