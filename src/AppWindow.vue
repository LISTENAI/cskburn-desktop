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
import { computed } from 'vue';
import {
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NMessageProvider,
  darkTheme,
  useOsTheme,
} from 'naive-ui';
import { useAppName, useAppVersion } from '@/composables/tauri/app';
import { bindTitle } from '@/composables/tauri/window';

import App from '@/App.vue';

const osTheme = useOsTheme();
const darkMode = computed(() => osTheme.value === 'dark');

const appName = useAppName();
const appVersion = useAppVersion();
bindTitle(() => {
  if (!appName.value || !appVersion.value) {
    return undefined;
  }

  return `${appName.value} - v${appVersion.value}`;
});
</script>
