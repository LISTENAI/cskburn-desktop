import type { Ref } from 'vue';

export async function busyOn<T>(promise: Promise<T>, busy: Ref<boolean>): Promise<T> {
  try {
    busy.value = true;
    return await promise;
  } finally {
    busy.value = false;
  }
}
