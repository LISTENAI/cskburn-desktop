<template>
  <div :class="$style.container">
    <n-button size="large" secondary round type="primary">开始烧录</n-button>
  </div>
</template>

<script lang="ts" setup>
import { NButton } from 'naive-ui';
</script>

<style lang="scss" module>
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}
</style>
