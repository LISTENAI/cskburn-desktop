<template>
  <field-base :class="{ [$style.completed]: props.progress == 1.0 }">
    {{ (props.progress * 100).toFixed(1) }}%
  </field-base>
</template>

<script lang="ts" setup>
import FieldBase from './FieldBase.vue';

const props = defineProps<{
  progress: number;
}>();
</script>

<style lang="scss" module>
.completed {
  color: var(--success-color);
}
</style>
