import { onBeforeUnmount, watch, type Ref } from 'vue';
import { watch as fsWatch, type UnwatchFn, type WatchEvent } from '@tauri-apps/plugin-fs';
import { basename, dirname } from '@tauri-apps/api/path';

import { HexFile, LocalFile, LpkFile } from '@/utils/file';
import type { IFlashImage } from '@/utils/images';

const DEBOUNCE_MS = 500;

export function useImageWatchers(images: Ref<IFlashImage[]>): void {
  // Keyed by file path, not image reference — the image object is replaced on
  // every refresh via splice, but the underlying path is stable. A path-keyed
  // map stays correct across refreshes without re-attaching the watcher.
  const watchers = new Map<string, Promise<UnwatchFn>>();
  const refreshing = new Set<string>();

  async function refreshImage(path: string): Promise<void> {
    if (refreshing.has(path)) return;
    refreshing.add(path);
    try {
      // Look up the current image by path each time rather than capturing a
      // reference in the watcher closure — the reference goes stale as soon
      // as refreshImage splices a new one in.
      const image = images.value.find((img) => img.file.path === path);
      if (!image) return;
      const refreshed = await reloadImage(image);
      if (!refreshed) return;
      const idx = images.value.findIndex((img) => img.file.path === path);
      if (idx < 0) return;
      images.value.splice(idx, 1, refreshed);
    } catch (e) {
      console.warn('Failed to refresh image metadata:', e);
    } finally {
      refreshing.delete(path);
    }
  }

  async function startWatcher(path: string): Promise<UnwatchFn> {
    const [dir, name] = await Promise.all([dirname(path), basename(path)]);
    return await fsWatch(dir, (event) => {
      if (eventMatchesName(event, name)) {
        void refreshImage(path);
      }
    }, { delayMs: DEBOUNCE_MS });
  }

  // deep: true so that remove/add flows that mutate `images.value` in place
  // (e.g. PartitionView's splice-based remove) also surface through the
  // callback; plain ref watch wouldn't fire on splice.
  watch(images, (newImages) => {
    const newPaths = new Set(newImages.map((img) => img.file.path));
    for (const [path, watcher] of watchers) {
      if (!newPaths.has(path)) {
        watchers.delete(path);
        watcher.then((unwatch) => unwatch()).catch(() => {});
      }
    }

    for (const image of newImages) {
      const path = image.file.path;
      if (watchers.has(path)) continue;
      const watcher = startWatcher(path).catch((e) => {
        console.warn('Failed to watch image file:', path, e);
        return () => {};
      });
      watchers.set(path, watcher);
    }
  }, { immediate: true, deep: true });

  onBeforeUnmount(() => {
    for (const watcher of watchers.values()) {
      watcher.then((unwatch) => unwatch()).catch(() => {});
    }
    watchers.clear();
  });
}

async function reloadImage(image: IFlashImage): Promise<IFlashImage | null> {
  if (image.format === 'bin') {
    const file = await LocalFile.from(image.file.path);
    return { format: 'bin', addr: image.addr, file, enabled: image.enabled };
  }
  if (image.format === 'lpk') {
    const file = await LpkFile.from(image.file.path);
    for (const part of file.partitions) {
      const old = image.file.partitions.find((p) => p.addr === part.addr);
      if (old) part.enabled = old.enabled;
    }
    return { format: 'lpk', file };
  }
  if (image.format === 'hex') {
    const file = await HexFile.from(image.file.path);
    for (const section of file.sections) {
      const old = image.file.sections.find((s) => s.address === section.address);
      if (old) section.enabled = old.enabled;
    }
    return { format: 'hex', file };
  }
  return null;
}

function eventMatchesName(event: WatchEvent, name: string): boolean {
  return event.paths.some((p) => basenameOf(p) === name);
}

function basenameOf(path: string): string {
  const sep = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return sep < 0 ? path : path.slice(sep + 1);
}
