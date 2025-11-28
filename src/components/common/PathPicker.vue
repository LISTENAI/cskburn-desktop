<template>
  <n-flex align="center" size="small" :wrap="false">
    <n-input :value="value" :disabled="props.disabled" size="small" :placeholder="props.placeholder" readonly
      :style="{ flex: '1 1 auto' }" />
    <n-button size="small" :disabled="props.disabled" @click="pick">
      <template #icon>
        <n-icon>
          <FolderOpen16Regular />
        </n-icon>
      </template>
    </n-button>
  </n-flex>
</template>

<script lang="ts" setup>
import { NButton, NFlex, NIcon, NInput } from 'naive-ui';
import { FolderOpen16Regular } from '@vicons/fluent';
import { open, type OpenDialogOptions } from '@tauri-apps/plugin-dialog';

const props = defineProps<{
  placeholder?: string;
  disabled?: boolean;
  openOptions?: OpenDialogOptions;
}>();

const value = defineModel<string | null>('value');

async function pick() {
  const result = await open(props.openOptions);
  if (result) {
    value.value = result;
  }
}
</script>
