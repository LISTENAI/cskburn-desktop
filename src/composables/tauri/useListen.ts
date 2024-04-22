import { onBeforeUnmount, onMounted } from 'vue';
import {
  listen,
  type EventCallback,
  type EventName,
  type UnlistenFn,
} from '@tauri-apps/api/event';

export function useListen<T>(event: EventName, handler: EventCallback<T>): void {
  let unlistenFn: UnlistenFn | undefined;
  let unmounted = false;

  onMounted(async () => {
    unlistenFn = await listen(event, handler);
    if (unmounted) {
      unlistenFn?.();
    }
  });

  onBeforeUnmount(() => {
    unmounted = true;
    unlistenFn?.();
  });
}
