<template>
  <n-spin :show="parsing" :delay="200" :content-style="{ height: '100%' }">
    <template #description>
      正在解析
    </template>
    <file-dropper :disabled="props.busy" :style="{ height: '100%' }" @file-drop="handleFiles">
      <n-element v-if="image == null" :class="$style.empty" :style="{ height: '100%' }">
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
      <n-element v-else-if="image.format == 'hex'" :class="$style.empty" :style="{ height: '100%' }">
        <n-flex :class="$style.hexFile" vertical align="center" justify="center" :wrap="false"
          :style="{ height: '100%' }">
          <selectable-text :class="$style.name" selectable>{{ image.file.name }}</selectable-text>
          <span>(<file-size :class="$style.size" :size="image.file.size" />)</span>
          <n-button secondary :disabled="props.busy" :style="{ marginTop: '16px' }" @click="() => image = null">
            重新选择
          </n-button>
        </n-flex>
      </n-element>
      <partition-table v-else-if="image.format == 'bin'" :partitions="image.partitions" :style="{ height: '100%' }">
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
          <field-base>
            <file-size :size="data.file.size" />
          </field-base>
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

import { processFiles, type IFlashImage } from '@/utils/images';
import { busyOn } from '@/composables/busyOn';

import FileDropper from '@/components/common/FileDropper.vue';
import FileSize from '@/components/common/FileSize.vue';
import SelectableText from '@/components/common/SelectableText.vue';
import PartitionTable from '@/components/common/PartitionTable.vue';

import FieldBase from '@/components/datatable/FieldBase.vue';
import FieldAddr from '@/components/datatable/FieldAddr.vue';
import FieldProgress from '@/components/datatable/FieldProgress.vue';

export interface IProgress {
  index: number;
  state: 'progress' | 'stopped' | 'error';
  current: number;
}

const image = defineModel<IFlashImage | null>('image');

const props = defineProps<{
  busy: boolean;
  progress: IProgress | null;
}>();

const parsing = ref(false);
async function handleFiles(files: string[]) {
  const parsed = await busyOn(processFiles(files), parsing);
  if (parsed.format == 'hex' || parsed.format != image.value?.format) {
    if (image.value?.format == 'bin') {
      await Promise.all(image.value.partitions.map((part) => part.file.free()));
    }
    image.value = parsed;
  } else {
    image.value = { ...image.value, partitions: image.value.partitions.concat(parsed.partitions) };
  }
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
  if (image.value?.format != 'bin') {
    return;
  }

  const file = image.value.partitions[index].file;
  const partitions = [...image.value.partitions];
  partitions.splice(index, 1);
  image.value = isEmpty(partitions) ? null : { ...image.value, partitions };
  await file?.free();
}
</script>

<style lang="scss" module>
.empty {
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
}

.hexFile {
  width: 100%;

  box-sizing: border-box;
  padding: 32px;

  font-family: var(--font-family-mono);

  .name {
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
