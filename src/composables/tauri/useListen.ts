import { onBeforeUnmount, onMounted } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

type ListenArgs<T> = Parameters<typeof listen<T>>;

export function useListen(creator: () => Promise<UnlistenFn>): void;
export function useListen<T>(...args: ListenArgs<T>): void;

export function useListen(...args: unknown[]): void {
  let unlistenFn: UnlistenFn | undefined;
  let unmounted = false;

  const listenFn = typeof args[0] == 'function' ? args[0] : listen;
  const listenArgs = typeof args[0] == 'function' ? [] : args;

  onMounted(async () => {
    unlistenFn = await listenFn(...listenArgs);
    if (unmounted) {
      unlistenFn?.();
    }
  });

  onBeforeUnmount(() => {
    unmounted = true;
    unlistenFn?.();
  });
}
