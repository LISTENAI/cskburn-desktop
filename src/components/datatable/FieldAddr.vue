<template>
  <n-input :class="$style.input" v-model:value="value" :allow-input="isHex" />
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { NInput } from 'naive-ui';

const addr = defineModel<number>('addr', { default: 0 });

const value = computed({
  get: () => `0x${addr.value.toString(16).padStart(8, '0')}`,
  set: (value: string) => {
    const val = parseInt(value, 16);
    addr.value = isNaN(val) ? 0 : val;
  },
});

function isHex(value: string): boolean {
  return value == '' || /^0x[0-9a-fA-F]+$/.test(value);
}
</script>

<style lang="scss" module>
.input {
  font-family: monospace;
}
</style>
