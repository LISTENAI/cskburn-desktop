import { sum } from 'radash';

import { HexFile, LocalFile, type IFileRef } from './file';
import { readLpk } from './readLpk';

export type IFlashImage = {
  format: 'bin';
  partitions: IPartition[];
} | {
  format: 'hex';
  file: HexFile;
};

export interface IPartition {
  addr: number;
  file: IFileRef;
}

export async function readImage(paths: string[]): Promise<IFlashImage> {
  const hexFile = paths.find((path) => path.toLowerCase().endsWith('.hex'));
  if (hexFile) {
    return {
      format: 'hex',
      file: await HexFile.from(hexFile),
    };
  }

  const partitions: IPartition[] = [];

  for (const path of paths) {
    if (path.toLowerCase().endsWith('.lpk')) {
      partitions.push(...await readLpk(path));
    } else {
      partitions.push({
        addr: 0,
        file: await LocalFile.from(path),
      });
    }
  }

  return { format: 'bin', partitions };
}

export async function cleanUpImage(image: IFlashImage): Promise<void> {
  if (image.format == 'hex') {
    await image.file.free();
  } else {
    await Promise.all(image.partitions.map((part) => part.file.free()));
  }
}

export function imageSize(image: IFlashImage, toIndex?: number): number {
  if (image.format == 'hex') {
    return sum(image.file.sections.slice(0, toIndex), (section) => section.size);
  } else {
    return sum(image.partitions.slice(0, toIndex), (part) => part.file.size);
  }
}
