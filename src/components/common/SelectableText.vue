<template>
  <span :class="{ [$style.selectable]: props.selectable }">
    <slot />
  </span>
</template>

<script lang="ts" setup>
const props = defineProps<{
  selectable?: boolean;
}>();
</script>

<style lang="scss" module>
.selectable {
  user-select: text;
  cursor: text;
}
</style>
