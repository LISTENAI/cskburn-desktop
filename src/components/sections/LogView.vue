<template>
  <n-element>
    <n-input ref="logs" type="textarea" :value="props.logs" placeholder="没有日志" readonly :resizable="false"
      :style="{ height: '100%', fontFamily: 'var(--font-family-mono)' }" />
  </n-element>
</template>

<script lang="ts" setup>
import { onMounted, useTemplateRef } from 'vue';
import { watchThrottled } from '@vueuse/core';
import { NElement, NInput, type InputInst } from 'naive-ui';

const props = defineProps<{
  logs: string;
}>();

const logsEl = useTemplateRef<InputInst>('logs');

function scrollToBottom() {
  logsEl.value?.scrollTo({
    behavior: 'instant',
    top: logsEl.value.textareaElRef?.scrollHeight ?? 0,
  });
}

watchThrottled(() => props.logs, () => {
  scrollToBottom();
}, { immediate: true, throttle: 100, trailing: true });

onMounted(() => {
  scrollToBottom();
});
</script>
