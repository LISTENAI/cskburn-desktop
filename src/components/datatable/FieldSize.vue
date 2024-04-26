<template>
  <field-base :class="$style.size" @click="switchUnit">
    {{ unit == 0 ? value : value.toFixed(2) }} {{ UNIT[unit] }}
  </field-base>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import FieldBase from './FieldBase.vue';

const UNIT = ['B', 'KB', 'MB'];

const props = defineProps<{
  size: number;
}>();

const unit = ref(Math.floor(Math.log2(props.size) / 10));
const value = computed(() => props.size / 2 ** (unit.value * 10));

const switchUnit = () => {
  unit.value = (unit.value + 1) % UNIT.length;
};
</script>

<style lang="scss" module>
.size {
  cursor: pointer;
}
</style>
