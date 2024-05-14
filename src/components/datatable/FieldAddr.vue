<template>
  <n-input :class="$style.input" />
</template>

<script lang="ts" setup>
import { NInput, useThemeVars } from 'naive-ui';
const themeVars = useThemeVars();
</script>

<style lang="scss" module>
.input {
  font-family: v-bind('themeVars.fontFamilyMono');
}
</style>
