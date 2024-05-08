<template>
  <n-modal :show="updating">
    <n-card :style="{ maxWidth: '400px' }" :bordered="false">
      <n-flex align="center" :size="16">
        <n-progress type="circle" :stroke-width="14" :show-indicator="done" :status="done ? 'success' : 'default'"
          :percentage :style="{ width: '32px' }" />
        <template v-if="!done">
          <div :style="{ flex: '1 1 auto' }">正在更新…</div>
        </template>
        <template v-else>
          <div :style="{ flex: '1 1 auto' }">更新完成</div>
          <n-button size="small" type="primary" @click="() => relaunch()">重新打开</n-button>
        </template>
      </n-flex>
    </n-card>
  </n-modal>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { NButton, NCard, NFlex, NModal, NProgress, useDialog } from 'naive-ui';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';

const dialog = useDialog();

const updating = ref(false);
const totalLength = ref(0);
const downloadedLength = ref(0);
const done = ref(false);

const percentage = computed(() => {
  return totalLength.value == 0 ? 0 : downloadedLength.value / totalLength.value * 100;
});

onMounted(async () => {
  let update: Update | null = null;

  try {
    update = await check();
  } catch (error) {
    console.error(error);
    console.warn('Failed to check for updates');
    return;
  }

  if (update?.available) {
    dialog.create({
      title: `发现新版本 ${update.version}，是否更新？`,
      closable: false,
      positiveText: '现在更新',
      negativeText: '暂不',
      onPositiveClick: async () => {
        updating.value = true;
        await update.downloadAndInstall((progress) => {
          switch (progress.event) {
            case 'Started':
              totalLength.value = progress.data.contentLength || 0;
              break;
            case 'Progress':
              downloadedLength.value += progress.data.chunkLength;
              break;
            case 'Finished':
              done.value = true;
              break;
          }
        });
      },
    });
  }
});
</script>
