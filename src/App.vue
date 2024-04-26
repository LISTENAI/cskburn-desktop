<template>
  <n-flex vertical :size="16" :style="{
    boxSizing: 'border-box',
    height: '100vh',
    padding: '16px'
  }">
    <n-flex align="center">
      <div>端口:</div>
      <n-select v-model:value="selectedPort" :options="availableSelections" :consistent-menu-width="false"
        :disabled="availableSelections.length == 0 || busyForInfo || busyForFlash" placeholder="空" :class="$style.port"
        :style="{ flex: '0 1 300px' }" />
    </n-flex>

    <n-flex :size="32" align="center">
      <div>CHIP ID: <span :class="$style.selectable">{{ chipId }}</span></div>
      <div>Flash ID: <span :class="$style.selectable">{{ flashId }}</span></div>
      <n-button secondary round size="small" :disabled="busyForInfo || busyForFlash" @click="fetchInfo">获取</n-button>
    </n-flex>

    <n-spin :show="parsing" :delay="200" :style="{ flex: '1 1 auto' }" :content-style="{ height: '100%' }">
      <template #description>
        正在解析
      </template>
      <file-dropper :disabled="busyForFlash" :style="{ height: '100%' }" @file-drop="handleFiles">
        <n-element v-if="partitions.length == 0" :style="{
          height: '100%',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius)',
        }">
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
        <partition-list v-else :partitions :style="{ height: '100%' }">
          <template #footer>
            <n-button text block :disabled="busyForFlash" @click="handleFilePick">
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
            <field-addr v-model:addr="data.addr" :disabled="busyForFlash" />
          </template>
          <template #column-size="{ data }">
            <field-size :size="data.file.size" />
          </template>
          <template #column-progress="{ index }">
            <template v-if="currentIndex == null || currentProgress == null || currentIndex < index">
              <n-text>未开始</n-text>
            </template>
            <template v-else-if="currentIndex == index">
              <template v-if="status == FlashStatus.STOPPED">
                <n-text type="error">已停止</n-text>
              </template>
              <template v-else-if="status == FlashStatus.ERROR">
                <n-text type="error">异常</n-text>
              </template>
              <template v-else>
                <field-progress :progress="currentProgress" />
              </template>
            </template>
            <template v-else-if="currentIndex > index">
              <field-progress :progress="1" />
            </template>
          </template>
          <template #column-actions="{ index }">
            <n-button quaternary circle size="small" :disabled="busyForFlash" @click="() => handlePartRemove(index)">
              <template #icon>
                <n-icon>
                  <delete-16-regular />
                </n-icon>
              </template>
            </n-button>
          </template>
        </partition-list>
      </file-dropper>
    </n-spin>

    <n-flex align="center" :size="32">
      <n-flex align="center" :style="{ width: 'auto', flex: '1 1 auto' }">
        <template v-if="busyForInfo || status == FlashStatus.CONNECTING">
          <n-spin size="small" />
        </template>
        <template v-else-if="status == FlashStatus.FLASHING">
          <n-progress type="line" :percentage="progress" :show-indicator="false" />
        </template>
        <template v-else-if="status == FlashStatus.SUCCESS">
          <n-text :class="$style.result" type="success">
            烧录成功
          </n-text>
        </template>
        <template v-else-if="status == FlashStatus.ERROR">
          <n-text :class="$style.result" type="error">
            烧录异常
          </n-text>
          <n-button secondary round size="small" @click="() => outputShown = !outputShown">
            查看日志
          </n-button>
        </template>
      </n-flex>

      <n-button v-if="busyForFlash" size="large" :style="{ flex: '0 0 140px' }" @click="stopFlash">
        停止
      </n-button>
      <n-button v-else size="large" type="primary" :disabled="!readyToFlash || busyForInfo"
        :style="{ flex: '0 0 140px' }" @click="startFlash">
        开始烧录
      </n-button>
    </n-flex>

    <n-input type="textarea" v-if="outputShown" :value="output" placeholder="" readonly :resizable="false"
      :style="{ height: '200px', fontFamily: 'monospace' }" />
  </n-flex>
</template>

<script lang="ts" setup>
import { computed, ref, useCssModule, watch } from 'vue';
import {
  NButton,
  NElement,
  NFlex,
  NIcon,
  NInput,
  NProgress,
  NSelect,
  NSpin,
  NText,
  type SelectOption,
} from 'naive-ui';
import {
  Add12Regular,
  Delete16Regular,
} from '@vicons/fluent';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { processFiles, type IPartition } from '@/utils/images';
import { cskburn } from '@/utils/cskburn';

import { useIntervally } from '@/composables/window/useIntervally';

import FileDropper from '@/components/FileDropper.vue';
import PartitionList from '@/components/PartitionList.vue';

import FieldBase from '@/components/FieldBase.vue';
import FieldAddr from '@/components/FieldAddr.vue';
import FieldSize from '@/components/FieldSize.vue';
import FieldProgress from '@/components/FieldProgress.vue';

const $style = useCssModule();

const selectedPort = ref<string | null>(null);
const availablePorts = useIntervally(1000, async () => await invoke('list_ports'));

const availableSelections = computed(() => (availablePorts.value ?? []).map((port) => ({
  label: port,
  value: port,
  class: $style.port,
}) as SelectOption));

watch(availablePorts, (ports) => {
  if (selectedPort.value) {
    if (!ports?.includes(selectedPort.value)) {
      selectedPort.value = ports?.[0] ?? null;
    }
  } else {
    selectedPort.value = ports?.[0] ?? null;
  }
});

const partitions = ref<IPartition[]>([]);
const parsing = ref(false);

async function handleFiles(files: string[]) {
  parsing.value = true;
  partitions.value = partitions.value.concat(await processFiles(files));
  parsing.value = false;
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
  const file = partitions.value[index].file;
  partitions.value.splice(index, 1);
  await file.free();
}

const chipId = ref('N/A');
const flashId = ref('N/A');

enum FlashStatus {
  CONNECTING,
  FLASHING,
  STOPPED,
  SUCCESS,
  ERROR,
}

const status = ref<null | FlashStatus>(null);
const busyForInfo = ref(false);
const busyForFlash = computed(() => status.value == FlashStatus.CONNECTING || status.value == FlashStatus.FLASHING);

const readyToFlash = computed(() => selectedPort.value != null && partitions.value.length > 0);

async function fetchInfo() {
  busyForInfo.value = true;

  await cskburn(selectedPort.value!, 1500000, [], {
    onChipId(id) {
      chipId.value = id;
    },
    onFlashId(id, size) {
      flashId.value = `${id} (${Math.round(size / 1024 / 1024)} MB)`;
    },
  });

  busyForInfo.value = false;
}

const output = ref('');
const outputShown = ref(false);

const currentIndex = ref<number | null>(null);
const currentProgress = ref<number | null>(null);

const progress = computed(() => {
  if (currentIndex.value == null || currentProgress.value == null) {
    return 0;
  }

  function totalSizeOf(parts: IPartition[]) {
    return parts.reduce((acc, part) => acc + part.file.size, 0);
  }

  const total = totalSizeOf(partitions.value);
  const wrote = totalSizeOf(partitions.value.slice(0, currentIndex.value));
  const current = partitions.value[currentIndex.value].file.size * currentProgress.value;

  return (wrote + current) / total * 100;
});

let aborter: AbortController | undefined;

async function startFlash() {
  const args = ['--verify-all'];
  for (const part of partitions.value) {
    args.push(part.addr.toString(), part.file.path);
  }

  aborter = new AbortController();

  currentIndex.value = null;
  currentProgress.value = null;
  outputShown.value = false;
  status.value = FlashStatus.CONNECTING;

  const result = await cskburn(selectedPort.value!, 1500000, args, {
    signal: aborter.signal,
    onChipId(id) {
      chipId.value = id;
    },
    onFlashId(id, size) {
      flashId.value = `${id} (${Math.round(size / 1024 / 1024)} MB)`;
    },
    onPartition(index, _total, _addr) {
      currentIndex.value = index;
      currentProgress.value = 0;
      status.value = FlashStatus.FLASHING;
    },
    onProgress(index, progress) {
      currentIndex.value = index;
      currentProgress.value = progress;
    },
    onError(_error) {
      status.value = FlashStatus.ERROR;
    },
  });

  output.value = result.output;

  // Only update status if status is not updated during flash
  if (busyForFlash.value) {
    status.value = result.code == 0 ? FlashStatus.SUCCESS : FlashStatus.ERROR;
  }
}

function stopFlash() {
  status.value = FlashStatus.STOPPED;
  aborter?.abort();
}
</script>

<style lang="scss" module>
:global(html, body) {
  user-select: none;
}

.port {
  font-family: monospace;
}

.selectable {
  user-select: text;
}

.result {
  font-size: 1.2em;
  font-weight: bold;
  margin-left: 8px;
}
</style>
