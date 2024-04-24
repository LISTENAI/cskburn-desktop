<template>
  <field-base>
    {{ props.name }}
  </field-base>
</template>

<script lang="ts" setup>
import FieldBase from './FieldBase.vue';

const props = defineProps<{
  name: string;
}>();
</script>
