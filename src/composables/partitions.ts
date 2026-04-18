import { computed, type Ref } from 'vue';

import type { IFlashImage, IPartition } from '@/utils/images';

export function usePartitions(images: Ref<IFlashImage[]>): Readonly<Ref<IPartition[]>> {
  return computed(() => images.value.flatMap((image) => {
    if (image.format === 'bin') {
      return { addr: image.addr, file: image.file, enabled: image.enabled };
    } else if (image.format === 'lpk') {
      return image.file.partitions.map((part) => ({ addr: part.addr, file: part.file, enabled: part.enabled }));
    } else if (image.format === 'hex') {
      return { addr: 0, file: image.file, enabled: true };
    } else {
      return [];
    }
  }));
}

export function useHexImage(images: Ref<IFlashImage[]>): Readonly<Ref<IFlashImage & { format: 'hex' } | undefined>> {
  return computed(() => images.value.find((image) => image.format === 'hex'));
}
