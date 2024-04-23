<template>
  <field-base>
    {{ basename(props.path) }}
  </field-base>
</template>

<script lang="ts" setup>
import { basename } from 'path';

import FieldBase from './FieldBase.vue';

const props = defineProps<{
  path: string;
}>();
</script>
