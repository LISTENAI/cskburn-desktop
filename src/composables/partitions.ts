import { computed, type Ref } from 'vue';

import type { IFlashImage, IPartition } from '@/utils/images';
import { resolveFlashOffset } from '@/utils/model';

export function usePartitions(images: Ref<IFlashImage[]>): Readonly<Ref<IPartition[]>> {
  return computed(() => images.value.flatMap((image) => {
    if (image.format === 'bin') {
      return { addr: image.addr, file: image.file, enabled: image.enabled };
    } else if (image.format === 'lpk') {
      return image.file.partitions.map((part) => ({ addr: part.addr, file: part.file, enabled: part.enabled }));
    } else if (image.format === 'hex') {
      return image.file.sections.map((section) => {
        const offset = resolveFlashOffset(section.address, section.file.size);
        if (offset != null) {
          return { addr: offset, file: section.file, enabled: section.enabled };
        }
        return {
          addr: section.address,
          file: section.file,
          enabled: section.enabled,
          invalidReason: '地址无法映射到 Flash 偏移',
        };
      });
    } else {
      return [];
    }
  }));
}

export function useHexImage(images: Ref<IFlashImage[]>): Readonly<Ref<IFlashImage & { format: 'hex' } | undefined>> {
  return computed(() => images.value.find((image) => image.format === 'hex'));
}
