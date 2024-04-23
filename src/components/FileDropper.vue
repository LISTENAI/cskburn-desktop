<template>
  <div :class="$style.container">
    <slot />
    <div v-if="dropping" :class="$style.dropping">
      <span>{{ props.hint || '将文件放置到此处' }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { TauriEvent } from '@tauri-apps/api/event';
import { useListen } from '@/composables/tauri/useListen';

const props = defineProps<{
  hint?: string;
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
  border: 2px dashed var(--n-color);
  border-radius: 3px;
  background: #ffffff;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
