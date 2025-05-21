import { computed, reactive, ref, type Ref } from 'vue';
import { imageSize, type IFlashImage } from '@/utils/images';

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

export function useFlashProgress(image: Ref<IFlashImage | null>, status: Ref<FlashStatus | null>): IFlashProgress {
  const current = ref<IFlashProgress['current']>(null);

  const perPartition = computed(() => {
    if (current.value == null) {
      return null;
    }

    if (image.value?.format != 'bin') {
      return null;
    }

    return image.value.partitions.map((_, index) => {
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
    if (image.value == null || current.value == null) {
      return 0;
    }

    const total = imageSize(image.value);
    const wrote = imageSize(image.value, current.value.index);
    if (image.value.format == 'bin') {
      const writing = image.value.partitions[current.value.index].file.size * current.value.progress;
      return (wrote + writing) / total;
    } else if (image.value.format == 'hex') {
      const writing = image.value.file.sections[current.value.index].size * current.value.progress;
      return (wrote + writing) / total;
    } else {
      return 0;
    }
  });

  return reactive({ current, perPartition, progress, status });
}
