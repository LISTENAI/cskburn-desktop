import { metadata } from 'tauri-plugin-fs-extra-api';

export interface IPartition {
  addr: number;
  size: number;
  path: string;
}

export async function processFiles(paths: string[]): Promise<IPartition[]> {
  const partitions: IPartition[] = [];

  for (const path of paths) {
    partitions.push({
      addr: 0,
      size: await getFileSize(path),
      path: path,
    });
  }

  return partitions;
}

async function getFileSize(path: string): Promise<number> {
  const { size } = await metadata(path);
  return size;
}
