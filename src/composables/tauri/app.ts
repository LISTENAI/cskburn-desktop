import { onMounted, ref, type Ref } from 'vue';
import { getName, getVersion } from '@tauri-apps/api/app';

export function useAppName(): Readonly<Ref<string | undefined>> {
  const name = ref<string>();

  onMounted(async () => {
    name.value = await getName();
  });

  return name;
}

export function useAppVersion(): Readonly<Ref<string | undefined>> {
  const version = ref<string>();

  onMounted(async () => {
    version.value = await getVersion();
  });

  return version;
}
