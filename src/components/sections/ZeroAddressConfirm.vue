<template>
  <n-modal :show="show" :bordered="false">
    <n-card :style="{ maxWidth: '480px' }">
      <template #header>
        <n-flex align="center" :size="8">
          <n-icon :class="$style.headerIcon" size="22">
            <Warning24Filled />
          </n-icon>
          <span>确认烧录 0x0 分区</span>
        </n-flex>
      </template>

      <n-flex vertical :size="12">
        <div v-if="props.mode === 'hex'">
          检测到 HEX 中存在位于 <strong>0x0</strong> 地址的 section。
          在 ADB 模式下覆盖该地址可能影响设备以 Recovery 模式启动。
        </div>
        <div v-else>
          检测到已启用位于 <strong>0x0</strong> 地址的分区。
          在 ADB 模式下覆盖该分区可能影响设备以 Recovery 模式启动。
          默认将跳过 0x0 分区继续烧录其余分区。
        </div>

        <n-collapse>
          <n-collapse-item title="高级选项" name="advanced">
            <n-checkbox v-model:checked="burnZero" :theme-overrides="dangerCheckbox">
              <n-text type="error">仍要烧录 0x0 分区</n-text>
            </n-checkbox>
          </n-collapse-item>
        </n-collapse>
      </n-flex>

      <template #footer>
        <n-flex justify="end">
          <n-button secondary @click="emit('cancel')">终止烧录</n-button>
          <template v-if="props.mode === 'hex'">
            <n-button type="error" :disabled="!burnZero" @click="emit('continue')">烧录全部</n-button>
          </template>
          <template v-else>
            <n-button v-if="burnZero" type="error" @click="emit('continue')">烧录全部</n-button>
            <n-button v-else type="success" @click="emit('skip')">跳过 0x0 地址烧录</n-button>
          </template>
        </n-flex>
      </template>
    </n-card>
  </n-modal>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import {
  NButton,
  NCard,
  NCheckbox,
  NCollapse,
  NCollapseItem,
  NFlex,
  NIcon,
  NModal,
  NText,
  useThemeVars,
} from 'naive-ui';
import { Warning24Filled } from '@vicons/fluent';

const props = withDefaults(defineProps<{
  show: boolean;
  mode?: 'partition' | 'hex';
}>(), {
  mode: 'partition',
});

const emit = defineEmits<{
  continue: [];
  skip: [];
  cancel: [];
}>();

const burnZero = ref(false);

watch(() => props.show, (shown) => {
  if (shown) {
    burnZero.value = false;
  }
});

const themeVars = useThemeVars();

const dangerCheckbox = computed(() => ({
  colorChecked: themeVars.value.errorColor,
  borderChecked: `1px solid ${themeVars.value.errorColor}`,
  borderFocusChecked: `1px solid ${themeVars.value.errorColor}`,
  boxShadowFocusChecked: `0 0 0 2px ${themeVars.value.errorColor}33`,
}));
</script>

<style lang="scss" module>
.headerIcon {
  color: var(--n-color-warning, #f0a020);
}
</style>
