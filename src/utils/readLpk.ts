import promisify from 'pify';
import { unzip as _unzip } from 'fflate';
import md5 from 'md5';
import {
  createDir,
  readBinaryFile,
  removeFile,
  writeBinaryFile,
} from '@tauri-apps/api/fs';
import {
  appCacheDir,
  basename,
  join,
} from '@tauri-apps/api/path';

import type { IFileRef, IPartition } from './images';
import { UserError } from '@/userError';

const unzip = promisify(_unzip);

export async function readLpk(path: string): Promise<IPartition[]> {
  const buffer = await readBinaryFile(path);
  const zip = await unzip(buffer);

  if (!zip['manifest.json']) {
    throw new UserError('该文件不是一个合法的 LPK', '缺少 manifest.json');
  }

  const manifest = JSON.parse(new TextDecoder().decode(zip['manifest.json']));

  if (typeof manifest.chip != 'string' || !(manifest.chip as string).toLocaleLowerCase().startsWith('csk6')) {
    throw new UserError('该文件不是一个合法的 LPK', '仅支持 CSK6 系列');
  }

  if (!manifest.images || !Array.isArray(manifest.images)) {
    throw new UserError('该文件不是一个合法的 LPK', 'manifest.json 缺少字段 "images"');
  }

  if (manifest.images.length == 0) {
    throw new UserError('该文件不是一个合法的 LPK', 'manifest.json 的 "images" 字段为空');
  }

  const partitions: IPartition[] = [];

  for (const image of manifest.images) {
    for (const field of ['addr', 'file', 'md5']) {
      if (typeof image[field] != 'string') {
        throw new UserError('该文件不是一个合法的 LPK', 'manifest.json 缺少字段 "addr"');
      }
    }

    const addr = parseAddr(image.addr);
    if (typeof addr == 'undefined') {
      throw new UserError('该文件不是一个合法的 LPK', `manifest.json 字段 "addr" 无法解析: ${image.addr}`);
    }

    const path = image.file.substring(2);
    if (!zip[path]) {
      throw new UserError('该文件不是一个合法的 LPK', `未找到文件 ${image.file}`);
    }

    const actualMd5 = md5(zip[path]).toLowerCase();
    if (actualMd5 != image.md5.toLowerCase()) {
      throw new UserError('该文件不是一个合法的 LPK', `manifest.json 字段 "md5" 与文件 ${image.file} 实际 MD5 不一致`);
    }

    partitions.push({
      addr: addr,
      file: await LpkBinFile.from(path, zip[path]),
    });
  }

  return partitions;
}

class LpkBinFile implements IFileRef {
  static async from(pseudoPath: string, content: Uint8Array): Promise<LpkBinFile> {
    const unpackDir = await join(await appCacheDir(), 'lpk_unpack');
    await createDir(unpackDir, { recursive: true });

    const path = await join(unpackDir, generateTempFileName());
    const name = await basename(pseudoPath);

    await writeBinaryFile(path, content);

    return new LpkBinFile(path, name, content.length);
  }

  private constructor(
    readonly path: string,
    readonly name: string,
    readonly size: number) {
  }

  async free(): Promise<void> {
    await removeFile(this.path);
  }
}

function parseAddr(addr: string): number | undefined {
  if (addr.match(/^[0-9]+$/)) {
    return parseInt(addr);
  } else if (addr.match(/^0x[0-9A-Fa-f]+$/)) {
    return parseInt(addr.substring(2), 16);
  } else {
    return undefined;
  }
}

function generateTempFileName(): string {
  return `${Math.random().toString(36).substring(2)}.bin`;
}
