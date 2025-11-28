<template>
  <n-modal v-model:show="show" :style="{ maxWidth: '600px' }" :bordered="false">
    <n-card title="设置">
      <template #footer>
        <n-flex justify="end">
          <n-button secondary size="medium" @click="close">关闭</n-button>
          <n-button type="primary" size="medium" :disabled="!canSave" @click="save">保存设置</n-button>
        </n-flex>
      </template>
      <n-form label-placement="left" label-width="120px">
        <n-form-item label="操作记录">
          <n-space vertical :style="{ width: '100%', marginTop: '6px' }">
            <n-checkbox v-model:checked="form.saveLogs">保留操作记录</n-checkbox>
            <path-picker v-model:value="form.logDir" :disabled="!form.saveLogs" placeholder="记录保存路径"
              :open-options="{ directory: true }" />
          </n-space>
        </n-form-item>
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
      </n-form>
    </n-card>
  </n-modal>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive } from 'vue';
import {
  NButton,
  NCard,
  NCheckbox,
  NFlex,
  NForm,
  NFormItem,
  NModal,
  NSpace,
  useMessage,
} from 'naive-ui';

import { settings } from '@/composables/tauri/settings';

import PathPicker from '@/components/common/PathPicker.vue';
import FieldAddr from '@/components/datatable/FieldAddr.vue';

import { DEFAULT_BAUD_RATE } from '@/utils/cskburn';

const message = useMessage();

const show = defineModel<boolean>('show', { default: true });

const form = reactive<{
  saveLogs: boolean;
  logDir: string | null;
  serialBaudRate: number;
}>({
  saveLogs: false,
  logDir: null,
  serialBaudRate: DEFAULT_BAUD_RATE,
});

onMounted(async () => {
  form.saveLogs = await settings.get('saveLogs') ?? false;
  form.logDir = await settings.get('logDir') ?? null;
  form.serialBaudRate = await settings.get('serialBaudRate') ?? DEFAULT_BAUD_RATE;
});

const canSave = computed(() => {
  return !form.saveLogs || (form.saveLogs && form.logDir);
});

function close() {
  show.value = false;
}

async function save() {
  if (!form.saveLogs) {
    form.logDir = null;
  }

  await settings.set('saveLogs', form.saveLogs);
  await settings.set('logDir', form.logDir);
  await settings.set('serialBaudRate', form.serialBaudRate);
  await settings.save();

  show.value = false;
  message.success('设置已保存');
}
</script>
