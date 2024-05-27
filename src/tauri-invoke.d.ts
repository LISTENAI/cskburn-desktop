import '@tauri-apps/api/core';

declare module '@tauri-apps/api/core' {
  import type { ISection } from '@/utils/readHex';
  import type { IPartition } from '@/utils/images';
  function invoke(cmd: 'read_hex', args: { path: string }): Promise<ISection[]>;
  function invoke(cmd: 'read_lpk', args: { path: string }): Promise<IPartition[]>;
  function invoke(cmd: 'list_ports'): Promise<string[]>;
  function invoke(cmd: 'decode', args: { data: ArrayLike<number> }): Promise<string>;
}
