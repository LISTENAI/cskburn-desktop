import { onMounted, ref, watch, type Ref } from 'vue';
import { LazyStore } from '@tauri-apps/plugin-store';

import { useListen } from '@/composables/tauri/useListen';

export const settings = new LazyStore('settings.json');

export function useSettings<T>(key: string): Ref<T | undefined> {
  const val = ref<T>();

  onMounted(async () => {
    val.value = await settings.get<T>(key);
  });

  watch(val, async (newVal) => {
    await settings.set(key, newVal);
  });

  useListen(() => settings.onKeyChange(key, (value) => {
    if (val.value != value) {
      val.value = value as T;
    }
  }));

  return val;
}
