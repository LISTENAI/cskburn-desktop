import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

export function useIntervally<T>(interval: number, generateFn: () => T | Promise<T>): Ref<T | undefined> {
  const value = ref<T>();
  let intervalId: ReturnType<typeof setInterval> | undefined;

  onMounted(async () => {
    intervalId = setInterval(async () => {
      value.value = await generateFn();
    }, interval);

    value.value = await generateFn();
  });

  onBeforeUnmount(() => {
    if (typeof intervalId != 'undefined') {
      clearInterval(intervalId);
    }
  });

  return value;
}
