import { basename } from '@tauri-apps/api/path';
import { stat } from '@tauri-apps/plugin-fs';
import { sum } from 'radash';

import { readLpk } from './readLpk';
import { readHex, type ISection } from './readHex';

export type IFlashImage = {
  format: 'bin';
  partitions: IPartition[];
} | {
  format: 'hex';
  file: IFileRef;
  sections: ISection[];
};

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

export async function processFiles(paths: string[]): Promise<IFlashImage> {
  const hexFile = paths.find((path) => path.toLowerCase().endsWith('.hex'));
  if (hexFile) {
    return {
      format: 'hex',
      file: await LocalBinFile.from(hexFile),
      sections: await readHex(hexFile),
    };
  }

  const partitions: IPartition[] = [];

  for (const path of paths) {
    if (path.toLowerCase().endsWith('.lpk')) {
      partitions.push(...await readLpk(path));
    } else {
      partitions.push({
        addr: 0,
        file: await LocalBinFile.from(path),
      });
    }
  }

  return { format: 'bin', partitions };
}

export function imageSize(image: IFlashImage, toIndex?: number): number {
  if (image.format == 'hex') {
    return sum(image.sections.slice(0, toIndex), (section) => section.size);
  } else {
    return sum(image.partitions.slice(0, toIndex), (part) => part.file.size);
  }
}

class LocalBinFile implements IFileRef {
  static async from(path: string): Promise<LocalBinFile> {
    const name = await basename(path);
    const { size } = await stat(path);
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
