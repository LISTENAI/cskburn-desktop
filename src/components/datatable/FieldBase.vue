<template>
  <n-flex :class="$style.field" :size="8" align="center">
    <n-element :class="$style.value">
      <selectable-text :selectable="props.selectable">
        <slot />
      </selectable-text>
    </n-element>
    <template v-for="button in (props.buttons || [])">
      <n-tooltip>
        <template #trigger>
          <n-button :class="$style.button" size="small" quaternary circle @click="button.onClick">
            <template #icon>
              <n-icon>
                <component :is="button.icon" />
              </n-icon>
            </template>
          </n-button>
        </template>
        {{ button.title }}
      </n-tooltip>
    </template>
  </n-flex>
</template>

<script lang="ts" setup>
import type { Component } from 'vue';
import {
  NButton,
  NElement,
  NFlex,
  NIcon,
  NTooltip,
} from 'naive-ui';

import SelectableText from '@/components/common/SelectableText.vue';

export interface FieldButtonOption {
  icon: Component;
  title: string;
  onClick: () => void;
}

const props = defineProps<{
  buttons?: FieldButtonOption[];
  selectable?: boolean;
}>();
</script>

<style lang="scss" module>
.field {
  .button {
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover {
    .button {
      opacity: 1;
    }
  }
}

.value {
  flex: 1 1 auto;
  font-family: var(--font-family-mono);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
</style>
