<template>
  <n-spin :show="parsing" :delay="200" :content-style="{ height: '100%' }">
    <template #description>
      正在解析
    </template>
    <file-dropper :disabled="props.busy" :style="{ height: '100%' }" @file-drop="handleFiles">
      <n-element v-if="images.length === 0" :class="$style.empty" :style="{ height: '100%' }">
        <n-flex align="center" justify="center" :style="{ height: '100%' }">
          <n-button quaternary round size="large" @click="handleFilePick">
            点击选择或将固件拖放到此处
            <template #icon>
              <n-icon>
                <Add12Regular />
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </n-element>
      <n-element v-else-if="hexImage" :class="$style.empty" :style="{ height: '100%' }">
        <n-flex :class="$style.hexFile" vertical align="center" justify="center" :wrap="false"
          :style="{ height: '100%' }">
          <selectable-text :class="$style.name" selectable>{{ hexImage.file.name }}</selectable-text>
          <n-space>
            <file-size :class="$style.size" :size="hexImage.file.size" />
            <span>-</span>
            <template v-if="props.errors[0]">
              <n-text type="error">{{ props.errors[0] }}</n-text>
            </template>
            <template v-if="props.progress.status === FlashStatus.STOPPED">
              <n-text type="error">已停止</n-text>
            </template>
            <template v-else-if="props.progress.status === FlashStatus.ERROR">
              <n-text type="error">异常</n-text>
            </template>
            <template v-else-if="props.progress.status === FlashStatus.FLASHING">
              <n-text>{{ (props.progress.progress * 100).toFixed(1) }}%</n-text>
            </template>
            <template v-else-if="props.progress.status === FlashStatus.VERIFYING">
              <n-text>校验中…</n-text>
            </template>
            <template v-else-if="props.progress.status === FlashStatus.SUCCESS">
              <n-text type="success">已完成</n-text>
            </template>
            <template v-else>
              <n-text>未开始</n-text>
            </template>
          </n-space>
          <n-space>
            <n-tooltip>
              <template #trigger>
                <n-button size="small" quaternary circle @click="() => hexImage?.file.reveal()">
                  <template #icon>
                    <n-icon>
                      <FolderOpen16Regular />
                    </n-icon>
                  </template>
                </n-button>
              </template>
              定位文件
            </n-tooltip>
            <n-tooltip>
              <template #trigger>
                <n-button size="small" quaternary circle :disabled="props.busy" @click="() => images = []">
                  <template #icon>
                    <n-icon>
                      <Delete16Regular />
                    </n-icon>
                  </template>
                </n-button>
              </template>
              重新选择
            </n-tooltip>
          </n-space>
        </n-flex>
      </n-element>
      <partition-table v-else :partitions :style="{ height: '100%' }">
        <template #footer>
          <n-button text block :disabled="props.busy" @click="handleFilePick">
            点击或拖放添加更多固件
            <template #icon>
              <n-icon>
                <Add12Regular />
              </n-icon>
            </template>
          </n-button>
        </template>
        <template #column-enabled="{ index }">
          <field-base>
            <n-checkbox :checked="partitions[index].enabled" :style="{ marginLeft: '8px' }"
              @update:checked="(val: boolean) => partitions[index].enabled = val" :disabled="props.busy" />
          </field-base>
        </template>
        <template #column-index="{ index }">
          <field-base>{{ index + 1 }}</field-base>
        </template>
        <template #column-name="{ data }">
          <field-base selectable>{{ data.file.name }}</field-base>
        </template>
        <template #column-addr="{ index }">
          <field-addr v-model:value="partitions[index].addr" :formatter="toHex" :parser="fromHex"
            :placeholder="toHex(partitions[index].addr)" :disabled="props.busy" />
        </template>
        <template #column-modified-at="{ data }">
          <field-base>
            <n-time :time="data.file.mtime" />
          </field-base>
        </template>
        <template #column-size="{ data }">
          <field-base>
            <file-size :size="data.file.size" />
          </field-base>
        </template>
        <template #column-progress="{ index }">
          <template v-if="!partitions[index].enabled">
            <n-text depth="3">已跳过</n-text>
          </template>
          <template v-else-if="!!props.errors[index]">
            <n-popover>
              <template #trigger>
                <n-button quaternary circle type="error" size="small">
                  <template #icon>
                    <n-icon>
                      <ErrorCircle16Regular />
                    </n-icon>
                  </template>
                </n-button>
              </template>
              <span>{{ props.errors[index] }}</span>
            </n-popover>
          </template>
          <template v-else-if="props.progress.perPartition?.[index]?.status === FlashStatus.STOPPED">
            <n-text type="error">已停止</n-text>
          </template>
          <template v-else-if="props.progress.perPartition?.[index]?.status === FlashStatus.ERROR">
            <n-text type="error">异常</n-text>
          </template>
          <template v-else-if="props.progress.perPartition?.[index]?.status === FlashStatus.FLASHING">
            <field-progress v-if="typeof props.progress.perPartition?.[index]?.progress === 'number'"
              :progress="props.progress.perPartition?.[index]?.progress" />
            <n-text v-else>烧录中…</n-text>
          </template>
          <template v-else-if="props.progress.perPartition?.[index]?.status === FlashStatus.VERIFYING">
            <n-text>校验中…</n-text>
          </template>
          <template v-else-if="props.progress.perPartition?.[index]?.status === FlashStatus.SUCCESS">
            <n-text type="success">已完成</n-text>
          </template>
          <template v-else>
            <n-text>未开始</n-text>
          </template>
        </template>
        <template #column-actions="{ data }">
          <n-space>
            <n-tooltip>
              <template #trigger>
                <n-button quaternary circle size="small" @click="() => data.file.reveal()">
                  <template #icon>
                    <n-icon>
                      <FolderOpen16Regular />
                    </n-icon>
                  </template>
                </n-button>
              </template>
              定位文件
            </n-tooltip>
            <n-tooltip>
              <template #trigger>
                <n-button quaternary circle size="small" :disabled="props.busy" @click="() => data.remove()">
                  <template #icon>
                    <n-icon>
                      <Delete16Regular />
                    </n-icon>
                  </template>
                </n-button>
              </template>
              从列表移除
            </n-tooltip>
          </n-space>
        </template>
      </partition-table>
    </file-dropper>
  </n-spin>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import {
  NButton,
  NCheckbox,
  NElement,
  NFlex,
  NIcon,
  NPopover,
  NSpace,
  NSpin,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui';
import {
  Add12Regular,
  Delete16Regular,
  ErrorCircle16Regular,
  FolderOpen16Regular,
} from '@vicons/fluent';
import { isEmpty } from 'radash';
import { open } from '@tauri-apps/plugin-dialog';

import { UserError } from '@/userError';
import { readImages, type IFlashImage, type IPartition } from '@/utils/images';
import { fromHex, toHex } from '@/utils/hex';

import { busyOn } from '@/composables/busyOn';
import { FlashStatus, type IFlashProgress } from '@/composables/progress';
import { useHexImage } from '@/composables/partitions';

import FileDropper from '@/components/common/FileDropper.vue';
import FileSize from '@/components/common/FileSize.vue';
import SelectableText from '@/components/common/SelectableText.vue';
import PartitionTable from '@/components/common/PartitionTable.vue';

import FieldBase from '@/components/datatable/FieldBase.vue';
import FieldAddr from '@/components/datatable/FieldAddr.vue';
import FieldProgress from '@/components/datatable/FieldProgress.vue';

const images = defineModel<IFlashImage[]>('images', { default: [] });

const props = defineProps<{
  busy: boolean;
  progress: IFlashProgress;
  errors: (string | undefined)[];
  isAdb?: boolean;
}>();

const message = useMessage();

const parsing = ref(false);
async function handleFiles(files: string[]) {
  try {
    const parsed = await busyOn(readImages(files), parsing);
    if (props.isAdb) {
      for (const image of parsed) {
        if (image.format === 'lpk') {
          for (const part of image.file.partitions) {
            if (part.addr === 0) {
              part.enabled = false;
            }
          }
        }
      }
    }
    const pendingHexImage = parsed.find((image) => image.format === 'hex');
    if (pendingHexImage) {
      // Only one hex file is allowed
      images.value = [pendingHexImage];
    } else if (images.value.some((image) => image.format === 'hex')) {
      images.value = parsed;
    } else {
      images.value = [...images.value, ...parsed];
    }
  } catch (e) {
    if (e instanceof UserError) {
      message.error(e.summary);
    } else {
      console.error(e);
      message.error('解析固件失败');
    }
  }
}

const hexImage = useHexImage(images);

interface IPartitionRecord extends IPartition {
  remove(): void;
}

const partitions = computed<IPartitionRecord[]>(() => images.value.flatMap((image, imageIndex) => {
  switch (image.format) {
    case 'bin':
      return {
        get addr() { return image.addr },
        set addr(val: number) { image.addr = val },
        get enabled() { return image.enabled ?? true },
        set enabled(val: boolean) { image.enabled = val },
        file: image.file,
        remove: () => {
          images.value.splice(imageIndex, 1);
        },
      };
    case 'lpk':
      return image.file.partitions.map((part, partIndex) => ({
        get addr() { return part.addr },
        set addr(val: number) { part.addr = val },
        get enabled() { return part.enabled },
        set enabled(val: boolean) { part.enabled = val },
        file: part.file,
        remove: () => {
          image.file.partitions.splice(partIndex, 1);
          if (isEmpty(image.file.partitions)) {
            images.value.splice(imageIndex, 1);
          }
        },
      }));
    default:
      return [];
  }
}));

async function handleFilePick() {
  const selected = await open({
    multiple: true,
  });

  if (selected && selected.length > 0) {
    await handleFiles(selected);
  }
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
