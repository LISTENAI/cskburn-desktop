import { remove } from '@tauri-apps/plugin-fs';
import pMap from 'p-map';

import { UserError } from '@/userError';

import { HexFile, LocalFile, LpkFile, type IFileRef } from './file';
import { resolveFlashOffset } from './model';
import { extractHex, type ISection } from './readHex';
import { extractLpk } from './readLpk';

export type IFlashImage =
  ({
    format: 'bin';
  } & IPartition) |
  {
    format: 'lpk';
    file: LpkFile;
  } |
  {
    format: 'hex';
    file: HexFile;
  };

export interface IPartition {
  addr: number;
  file: IFileRef;
  enabled: boolean;
  invalidReason?: string;
}

export type CleanupFn = () => Promise<void>;

export interface IExtractedImages {
  partitions: IPartition[];
  cleanup: CleanupFn;
}

export async function readImages(paths: string[]): Promise<IFlashImage[]> {
  const files = paths.map((path) => ({
    path,
    ext: path.toLowerCase().split('.').pop(),
  }));

  const hexFile = files.find(({ ext }) => ext === 'hex');
  if (hexFile) {  // Only one hex file is allowed
    return [{
      format: 'hex',
      file: await HexFile.from(hexFile.path),
    }];
  }

  return await pMap(files, async ({ path, ext }) => {
    if (ext === 'lpk') {
      return {
        format: 'lpk',
        file: await LpkFile.from(path),
      };
    } else {
      return {
        format: 'bin',
        addr: 0,
        file: await LocalFile.from(path),
        enabled: true,
      };
    }
  });
}

export async function extractImages(images: IFlashImage[]): Promise<IExtractedImages> {
  const tmpPaths: string[] = [];
  const partitions: IPartition[] = [];

  const cleanup: CleanupFn = async () => {
    await Promise.all(tmpPaths.map(async (p) => {
      try {
        await remove(p);
      } catch {
        // best-effort cleanup; cleanUpTmpFiles() on app exit is the safety net
      }
    }));
  };

  try {
    for (const image of images) {
      if (image.format === 'bin') {
        partitions.push({ addr: image.addr, file: image.file, enabled: image.enabled });
      } else if (image.format === 'lpk') {
        let extracted: IPartition[];
        try {
          extracted = await extractLpk(image.file.path);
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e);
          throw new UserError(`解包 ${image.file.name} 失败`, detail);
        }
        image.file.partitions.forEach((part, i) => {
          const tmp = extracted[i];
          if (!tmp) return;
          tmpPaths.push(tmp.file.path);
          partitions.push({ addr: part.addr, file: tmp.file, enabled: part.enabled });
        });
      } else if (image.format === 'hex') {
        let extracted: ISection[];
        try {
          extracted = await extractHex(image.file.path);
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e);
          throw new UserError(`解包 ${image.file.name} 失败`, detail);
        }
        image.file.sections.forEach((section, i) => {
          const tmp = extracted[i];
          if (!tmp) return;
          tmpPaths.push(tmp.file.path);
          const offset = resolveFlashOffset(section.address, tmp.file.size);
          if (offset != null) {
            partitions.push({ addr: offset, file: tmp.file, enabled: section.enabled });
          } else {
            partitions.push({
              addr: section.address,
              file: tmp.file,
              enabled: section.enabled,
              invalidReason: '地址无法映射到 Flash 偏移',
            });
          }
        });
      }
    }
  } catch (e) {
    await cleanup();
    throw e;
  }

  return { partitions, cleanup };
}
