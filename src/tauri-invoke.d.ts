declare module '@tauri-apps/api/core' {
  import { invoke, type InvokeArgs } from '@tauri-apps/api/core';
  function invoke<T>(cmd: string, args?: InvokeArgs): Promise<T>;
  function invoke(cmd: 'list_ports'): Promise<string[]>;
  function invoke(cmd: 'decode', args: { data: ArrayLike<number> }): Promise<string>;
}
