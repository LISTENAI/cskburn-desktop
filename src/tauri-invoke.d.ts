declare module '@tauri-apps/api/tauri' {
  import { invoke, type InvokeArgs } from '@tauri-apps/api/tauri';
  function invoke<T>(cmd: string, args?: InvokeArgs): Promise<T>;
  function invoke(cmd: 'list_ports'): Promise<string[]>;
}
