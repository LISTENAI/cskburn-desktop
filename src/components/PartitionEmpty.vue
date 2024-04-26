<template>
  <n-element :class="$style.container">
    <n-flex align="center" justify="center" :style="{ height: '100%' }">
      <n-button quaternary round size="large" @click="() => emit('pick-file')">
        点击选择或将固件拖放到此处
        <template #icon>
          <n-icon>
            <add-12-regular />
          </n-icon>
        </template>
      </n-button>
    </n-flex>
  </n-element>
</template>

<script lang="ts" setup>
import { NButton, NElement, NFlex, NIcon } from 'naive-ui';
import { Add12Regular } from '@vicons/fluent';

const emit = defineEmits<{
  (e: 'pick-file'): void;
}>();
</script>

<style lang="scss" module>
.container {
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
}
</style>
