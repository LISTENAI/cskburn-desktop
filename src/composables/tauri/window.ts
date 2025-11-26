import { watch, type WatchSource } from 'vue';
import { watchThrottled } from '@vueuse/core';
import { getCurrentWindow, type ProgressBarState } from '@tauri-apps/api/window';

export function bindProgressBar(state: WatchSource<ProgressBarState>, window = getCurrentWindow()): void {
  watchThrottled(state, async (state) => {
    await window.setProgressBar(state);
  }, { immediate: true, throttle: 500 });
}

export function bindTitle(title: WatchSource<string | undefined>, window = getCurrentWindow()): void {
  watch(title, async (title) => {
    if (title != undefined) {
      await window.setTitle(title);
    }
  }, { immediate: true });
}
