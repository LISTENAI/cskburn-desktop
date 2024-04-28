<template>
  <n-spin :show="parsing" :delay="200" :content-style="{ height: '100%' }">
    <template #description>
      正在解析
    </template>
    <file-dropper :disabled="props.busy" :style="{ height: '100%' }" @file-drop="handleFiles">
      <n-element v-if="!partitions || isEmpty(partitions)" :class="$style.empty" :style="{ height: '100%' }">
        <n-flex align="center" justify="center" :style="{ height: '100%' }">
          <n-button quaternary round size="large" @click="handleFilePick">
            点击选择或将固件拖放到此处
            <template #icon>
              <n-icon>
                <add-12-regular />
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </n-element>
      <partition-table v-else :partitions :style="{ height: '100%' }">
        <template #footer>
          <n-button text block :disabled="props.busy" @click="handleFilePick">
            点击或拖放添加更多固件
            <template #icon>
              <n-icon>
                <add-12-regular />
              </n-icon>
            </template>
          </n-button>
        </template>
        <template #column-index="{ index }">
          <field-base>{{ index + 1 }}</field-base>
        </template>
        <template #column-name="{ data }">
          <field-base selectable>{{ data.file.name }}</field-base>
        </template>
        <template #column-addr="{ data }">
          <field-addr v-model:addr="data.addr" :disabled="props.busy" />
        </template>
        <template #column-size="{ data }">
          <field-size :size="data.file.size" />
        </template>
        <template #column-progress="{ index }">
          <template v-if="props.progress == null || props.progress.index < index">
            <n-text>未开始</n-text>
          </template>
          <template v-else-if="props.progress.index == index">
            <template v-if="props.progress.state == 'stopped'">
              <n-text type="error">已停止</n-text>
            </template>
            <template v-else-if="props.progress.state == 'error'">
              <n-text type="error">异常</n-text>
            </template>
            <template v-else>
              <field-progress :progress="props.progress.current" />
            </template>
          </template>
          <template v-else-if="props.progress.index > index">
            <field-progress :progress="1" />
          </template>
        </template>
        <template #column-actions="{ index }">
          <n-button quaternary circle size="small" :disabled="props.busy" @click="() => handlePartRemove(index)">
            <template #icon>
              <n-icon>
                <delete-16-regular />
              </n-icon>
            </template>
          </n-button>
        </template>
      </partition-table>
    </file-dropper>
  </n-spin>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import {
  NButton,
  NElement,
  NFlex,
  NIcon,
  NSpin,
  NText,
} from 'naive-ui';
import {
  Add12Regular,
  Delete16Regular,
} from '@vicons/fluent';
import { isEmpty } from 'radash';
import { open } from '@tauri-apps/api/dialog';

import { processFiles, type IPartition } from '@/utils/images';
import { busyOn } from '@/composables/busyOn';

import FileDropper from '@/components/common/FileDropper.vue';
import PartitionTable from '@/components/common/PartitionTable.vue';

import FieldBase from '@/components/datatable/FieldBase.vue';
import FieldAddr from '@/components/datatable/FieldAddr.vue';
import FieldSize from '@/components/datatable/FieldSize.vue';
import FieldProgress from '@/components/datatable/FieldProgress.vue';

export interface IProgress {
  index: number;
  state: 'progress' | 'stopped' | 'error';
  current: number;
}

const partitions = defineModel<IPartition[]>('partitions');

const props = defineProps<{
  busy: boolean;
  progress: IProgress | null;
}>();

const parsing = ref(false);
async function handleFiles(files: string[]) {
  const parts = await busyOn(processFiles(files), parsing);
  partitions.value = (partitions.value ?? []).concat(parts);
}

async function handleFilePick() {
  const selected = await open({
    multiple: true,
    filters: [{
      name: 'CSK6 固件文件',
      extensions: ['bin', 'hex', 'lpk']
    }],
  });

  if (selected) {
    await handleFiles(typeof selected == 'string' ? [selected] : selected);
  }
}

async function handlePartRemove(index: number) {
  const file = partitions.value![index].file;
  const copy = [...partitions.value!];
  copy.splice(index, 1);
  partitions.value = copy;
  await file.free();
}
</script>

<style lang="scss" module>
.empty {
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
}
</style>
