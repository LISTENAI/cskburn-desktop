<template>
  <field-base>
    0x{{ props.addr.toString(16).padStart(8, '0') }}
  </field-base>
</template>

<script lang="ts" setup>
import FieldBase from './FieldBase.vue';

const props = defineProps<{
  addr: number;
}>();
</script>
