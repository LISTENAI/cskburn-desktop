<template>
  <n-element :class="$style.container">
    <slot />
    <n-flex v-if="!disabled && dropping" align="center" justify="center" :class="$style.dropping">
      <span>{{ props.hint || '将文件放置到此处' }}</span>
    </n-flex>
  </n-element>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { NElement, NFlex } from 'naive-ui';
import { TauriEvent } from '@tauri-apps/api/event';
import { useListen } from '@/composables/tauri/useListen';

const props = defineProps<{
  hint?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'file-drop', files: string[]): void;
}>();

const dropping = ref(false);

useListen(TauriEvent.WINDOW_FILE_DROP_HOVER, () => {
  dropping.value = true;
});

useListen(TauriEvent.WINDOW_FILE_DROP_CANCELLED, () => {
  dropping.value = false;
});

useListen<string[]>(TauriEvent.WINDOW_FILE_DROP, (event) => {
  dropping.value = false;
  if (props.disabled) return;
  emit('file-drop', event.payload);
});
</script>

<style lang="scss" module>
.container {
  position: relative;
}

.dropping {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  border: 2px dashed var(--primary-color-hover);
  border-radius: var(--border-radius);
  background: var(--base-color);
}
</style>
