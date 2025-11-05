<template>
  <n-config-provider :theme="darkMode ? darkTheme : null">
    <n-dialog-provider>
      <n-message-provider>
        <App />
      </n-message-provider>
    </n-dialog-provider>
    <n-global-style />
  </n-config-provider>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import {
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NMessageProvider,
  darkTheme,
  useOsTheme,
} from 'naive-ui';
import { getName, getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';

import App from '@/App.vue';

const osTheme = useOsTheme();
const darkMode = computed(() => osTheme.value == 'dark');

onMounted(async () => {
  const name = await getName();
  const version = await getVersion();
  getCurrentWindow().setTitle(`${name} - v${version}`);
});
</script>
