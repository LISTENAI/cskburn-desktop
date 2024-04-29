<template>
  <n-config-provider :theme="darkMode ? darkTheme : null">
    <App />
    <n-global-style />
  </n-config-provider>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import {
  NConfigProvider,
  NGlobalStyle,
  darkTheme,
  useOsTheme,
} from 'naive-ui';

import App from '@/App.vue';

const osTheme = useOsTheme();
const darkMode = computed(() => osTheme.value == 'dark');
</script>
