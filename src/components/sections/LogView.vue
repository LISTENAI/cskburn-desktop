<template>
  <n-element>
    <n-input ref="el" type="textarea" :value="props.logs" placeholder="没有日志" readonly :resizable="false"
      :style="{ height: '100%', fontFamily: 'var(--font-family-mono)' }" />
  </n-element>
</template>

<script lang="ts" setup>
import { NElement, NInput, type InputInst } from 'naive-ui';
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{
  logs: string;
}>();

const el = ref<InputInst | null>(null);

watch(props, () => {
  nextTick(() => {
    el.value?.scrollTo({
      behavior: 'instant',
      top: el.value.textareaElRef?.scrollHeight ?? 0,
    });
  });
});
</script>
