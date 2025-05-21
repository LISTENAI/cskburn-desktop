<template>
  <n-input v-model:value="current" @blur="handleBlur" :class="$style.input" />
</template>

<script lang="ts" setup generic="T=string">
import { NInput, useThemeVars } from 'naive-ui';
import { ref, watch } from 'vue';

const value = defineModel<T>('value');

const props = defineProps<{
  formatter?: (value: T) => string;
  parser?: (value: string) => T | undefined;
}>();

function format(value: T | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  } else if (props.formatter) {
    return props.formatter(value);
  } else {
    return String(value ?? '');
  }
}

function parse(value: string | undefined): T | undefined {
  if (value === undefined) {
    return undefined;
  } else if (props.parser) {
    return props.parser(value);
  } else {
    return value as T;
  }
}

const current = ref<string | undefined>();

watch(value, (value) => {
  current.value = format(value);
}, { immediate: true });

function handleBlur() {
  const parsed = parse(current.value);
  if (parsed === undefined) {
    current.value = format(value.value);
  } else {
    value.value = parsed;
    current.value = format(parsed);
  }
}

const themeVars = useThemeVars();
</script>

<style lang="scss" module>
.input {
  font-family: v-bind('themeVars.fontFamilyMono');
}
</style>
