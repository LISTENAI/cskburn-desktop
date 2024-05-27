import { invoke, Channel } from '@tauri-apps/api/core';

type UnwatchFn = () => void;

export async function listPorts(): Promise<string[]> {
  return await invoke('list_ports');
}

export async function watchPorts(cb: (ports: string[]) => void): Promise<UnwatchFn> {
  const onEvent = new Channel<string[]>();
  onEvent.onmessage = cb;

  const rid = await invoke('watch_ports', {
    onEvent: onEvent,
  });

  return () => {
    void invoke('unwatch_ports', { rid });
  };
}
