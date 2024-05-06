<template>
  <n-config-provider :theme="darkMode ? darkTheme : null">
    <n-dialog-provider>
      <App />
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
  darkTheme,
  useOsTheme,
} from 'naive-ui';

import App from '@/App.vue';

const osTheme = useOsTheme();
const darkMode = computed(() => osTheme.value == 'dark');
</script>
