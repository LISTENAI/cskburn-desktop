<template>
  <n-config-provider :theme="darkMode ? darkTheme : null">
    <App />
    <n-global-style />
  </n-config-provider>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import {
  NConfigProvider,
  NGlobalStyle,
  darkTheme,
} from 'naive-ui';
import { appWindow } from '@tauri-apps/api/window';

import App from '@/App.vue';
import type { UnlistenFn } from '@tauri-apps/api/event';

const darkMode = ref(false);

let unlisten: UnlistenFn | undefined;

onMounted(async () => {
  unlisten = await appWindow.onThemeChanged(({ payload: theme }) => {
    darkMode.value = theme == "dark";
  });
});

onBeforeUnmount(() => {
  unlisten?.();
});
</script>
