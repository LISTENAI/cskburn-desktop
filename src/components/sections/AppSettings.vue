<template>
  <n-modal v-model:show="show" :style="{ maxWidth: '600px' }" :bordered="false">
    <n-card title="设置">
      <template #footer>
        <n-button type="primary" size="medium" :disabled="!canSave" @click="save">保存设置</n-button>
      </template>
      <n-flex vertical gap="16px">
        <n-checkbox v-model:checked="form.saveLogs">保留操作记录</n-checkbox>
        <n-space align="center" size="small">
          <n-input :value="form.logDir" :disabled="!form.saveLogs" size="small" placeholder="记录保存路径" readonly
            :style="{ flex: '1 1 auto' }" />
          <n-button size="small" :disabled="!form.saveLogs" @click="pickLogDir">
            <template #icon>
              <n-icon>
                <FolderOpen16Regular />
              </n-icon>
            </template>
          </n-button>
        </n-space>
      </n-flex>
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
  NIcon,
  NInput,
  NModal,
  NSpace,
  useMessage,
} from 'naive-ui';
import { FolderOpen16Regular } from '@vicons/fluent';
import { open } from '@tauri-apps/plugin-dialog';

import { settings } from '@/composables/tauri/settings';

const message = useMessage();

const show = defineModel<boolean>('show', { default: true });

const form = reactive<{
  saveLogs: boolean;
  logDir: string | null;
}>({
  saveLogs: false,
  logDir: null,
});

onMounted(async () => {
  form.saveLogs = await settings.get('saveLogs') ?? false;
  form.logDir = await settings.get('logDir') ?? null;
});

async function pickLogDir() {
  const dir = await open({ directory: true });
  if (dir) {
    form.logDir = dir;
  }
}

const canSave = computed(() => {
  return !form.saveLogs || (form.saveLogs && form.logDir);
});

async function save() {
  if (!form.saveLogs) {
    form.logDir = null;
  }

  await settings.set('saveLogs', form.saveLogs);
  await settings.set('logDir', form.logDir);
  await settings.save();
  show.value = false;
  message.success('设置已保存');
}
</script>
