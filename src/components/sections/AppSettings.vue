<template>
  <n-modal v-model:show="show" :style="{ maxWidth: '600px' }" :bordered="false">
    <n-card title="设置">
      <template #footer>
        <n-flex justify="end">
          <n-button secondary size="medium" @click="close">关闭</n-button>
          <n-button type="primary" size="medium" @click="save">保存设置</n-button>
        </n-flex>
      </template>
      <n-form label-placement="left" label-width="120px">
        <n-form-item label="串口波特率">
          <n-space size="small">
            <field-addr v-model:value="form.serialBaudRate" placeholder="请输入串口波特率"
              :formatter="(val: number) => String(val)" :parser="(val) => {
                const parsed = parseInt(val);
                return isNaN(parsed) ? undefined : parsed;
              }" />
            <n-button @click="() => form.serialBaudRate = DEFAULT_BAUD_RATE">恢复默认</n-button>
          </n-space>
        </n-form-item>
        <n-form-item label="ADB 版本">
          <span>{{ adbVersion ?? '未知' }}</span>
        </n-form-item>
      </n-form>
    </n-card>
  </n-modal>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref, watch } from 'vue';
import {
  NButton,
  NCard,
  NFlex,
  NForm,
  NFormItem,
  NModal,
  NSpace,
  useMessage,
} from 'naive-ui';

import { settings } from '@/composables/tauri/settings';

import FieldAddr from '@/components/datatable/FieldAddr.vue';

import { DEFAULT_BAUD_RATE } from '@/utils/cskburn';
import { checkVersion } from '@/utils/adb';

const message = useMessage();

const show = defineModel<boolean>('show', { default: false });

const form = reactive<{
  serialBaudRate: number;
}>({
  serialBaudRate: DEFAULT_BAUD_RATE,
});

watch(show, async (show) => {
  if (show) {
    form.serialBaudRate = await settings.get('serialBaudRate') ?? DEFAULT_BAUD_RATE;
  }
});

const adbVersion = ref<string | null>(null);
onMounted(async () => {
  adbVersion.value = await checkVersion();
});

function close() {
  show.value = false;
}

async function save() {
  await settings.set('serialBaudRate', form.serialBaudRate);
  await settings.save();

  show.value = false;
  message.success('设置已保存');
}
</script>
