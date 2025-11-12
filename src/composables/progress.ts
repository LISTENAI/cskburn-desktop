import { computed, reactive, ref, type Ref } from 'vue';
import { sum } from 'radash';

import type { IFlashImage } from '@/utils/images';

import { useHexImage, usePartitions } from './partitions';

export enum FlashStatus {
  CONNECTING,
  FLASHING,
  VERIFYING,
  STOPPED,
  SUCCESS,
  ERROR,
}

export interface IFlashProgress {
  current: { index: number, progress: number } | null;
  perPartition: ({ progress: number, status: FlashStatus | null } | null)[] | null;
  progress: number;
  status: FlashStatus | null;
}

export function useFlashProgress(images: Ref<IFlashImage[]>, status: Ref<FlashStatus | null>): IFlashProgress {
  const current = ref<IFlashProgress['current']>(null);

  const hexImage = useHexImage(images);
  const partitions = usePartitions(images);

  const perPartition = computed(() => {
    if (current.value == null) {
      return null;
    }

    if (hexImage.value) {
      return null;
    }

    return partitions.value.map((_, index) => {
      if (current.value == null || current.value.index < index) {
        return null;
      } else if (current.value.index == index) {
        return { progress: current.value.progress, status: status.value };
      } else {
        return { progress: 1, status: FlashStatus.SUCCESS };
      }
    });
  });

  const progress = computed(() => {
    if (images.value.length == 0 || current.value == null) {
      return 0;
    }

    const { index } = current.value;
    if (hexImage.value) {
      const { file } = hexImage.value;
      if (index >= file.sections.length) {
        return 0;
      }
      const wrote = sum(file.sections.slice(0, index), (section) => section.size);
      const writing = file.sections[index].size * current.value.progress;
      return (wrote + writing) / file.size;
    } else {
      if (index >= partitions.value.length) {
        return 0;
      }
      const total = sum(partitions.value, (part) => part.file.size);
      const wrote = sum(partitions.value.slice(0, index), (part) => part.file.size);
      const writing = partitions.value[index].file.size * current.value.progress;
      return (wrote + writing) / total;
    }
  });

  return reactive({ current, perPartition, progress, status });
}
