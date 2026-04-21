import type { Channel } from '@tauri-apps/api/core';
import type { IHexMeta, IExtractedSectionRaw } from '@/utils/readHex';
import type { ILpkMeta, IExtractedPartitionRaw } from '@/utils/readLpk';

declare module '@tauri-apps/api/core' {
  function invoke(cmd: 'inspect_hex', args: { path: string }): Promise<IHexMeta>;
  function invoke(cmd: 'extract_hex', args: { path: string }): Promise<IExtractedSectionRaw[]>;
  function invoke(cmd: 'inspect_lpk', args: { path: string }): Promise<ILpkMeta>;
  function invoke(cmd: 'extract_lpk', args: { path: string }): Promise<IExtractedPartitionRaw[]>;
  function invoke(cmd: 'list_ports'): Promise<string[]>;
  function invoke<T>(cmd: 'watch_ports', args: { onEvent: Channel<T> }): Promise<number>;
  function invoke(cmd: 'unwatch_ports', args: { rid: number }): Promise<void>;
  function invoke(cmd: 'decode', args: { data: ArrayLike<number> }): Promise<string>;
  function invoke(cmd: 'md5', args: { path: string }): Promise<string>;
}
