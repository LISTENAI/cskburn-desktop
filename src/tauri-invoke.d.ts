import type { Channel } from '@tauri-apps/api/core';
import type { ISection } from '@/utils/readHex';
import type { ILpkInfo } from '@/utils/readLpk';
import type { IPartition } from '@/utils/images';
import type { IDevice, ITransferEvent } from '@/utils/adb';

declare module '@tauri-apps/api/core' {
  function invoke(cmd: 'read_hex', args: { path: string }): Promise<ISection[]>;
  function invoke(cmd: 'read_lpk', args: { path: string }): Promise<ILpkInfo>;
  function invoke(cmd: 'list_ports'): Promise<string[]>;
  function invoke<T>(cmd: 'watch_ports', args: { onEvent: Channel<T> }): Promise<number>;
  function invoke(cmd: 'unwatch_ports', args: { rid: number }): Promise<void>;
  function invoke(cmd: 'adb_list_devices'): Promise<IDevice[]>;
  function invoke<T>(cmd: 'adb_watch_devices', args: { onEvent: Channel<T> }): Promise<number>;
  function invoke(cmd: 'adb_unwatch_devices', args: { rid: number }): Promise<void>;
  function invoke(cmd: 'adb_shell', args: { identifier: string; commands: string[] }): Promise<string>;
  function invoke(cmd: 'adb_push', args: { identifier: string; local: string; remote: string }): Promise<number>;
  function invoke(cmd: 'decode', args: { data: ArrayLike<number> }): Promise<string>;
}
