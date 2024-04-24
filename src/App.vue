<template>
  <n-flex vertical :size="16" :style="{
    boxSizing: 'border-box',
    height: '100vh',
    padding: '16px'
  }">
    <n-flex align="center">
      <div>端口:</div>
      <n-select v-model:value="selectedPort" :options="availableSelections" :consistent-menu-width="false"
        :disabled="availableSelections.length == 0 || busy || status == 'flashing'" placeholder="空" :class="$style.port"
        :style="{ flex: '0 1 300px' }" />
    </n-flex>

    <n-flex :size="32" align="center">
      <div>CHIP ID: <span :class="$style.selectable">{{ chipId }}</span></div>
      <div>Flash ID: <span :class="$style.selectable">{{ flashId }}</span></div>
      <n-button secondary round size="small" :disabled="busy || status == 'flashing'" @click="fetchInfo">获取</n-button>
    </n-flex>

    <n-spin :show="parsing" :delay="200" :style="{ flex: '1 1 auto' }" :content-style="{ height: '100%' }">
      <file-dropper :disabled="status == 'flashing'" :style="{ height: '100%' }" @file-drop="handleFiles">
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
        <partition-list v-else :partitions :current-index :current-progress :style="{ height: '100%' }">
          <template #append>
            <n-button text block :disabled="status == 'flashing'" @click="handleFilePick">
              点击或拖放添加更多固件
              <template #icon>
                <n-icon>
                  <add-12-regular />
                </n-icon>
              </template>
            </n-button>
          </template>
          <template #actions="{ index }">
            <n-button quaternary circle size="small" :disabled="status == 'flashing'"
              @click="() => handlePartRemove(index)">
              <template #icon>
                <n-icon>
                  <delete-16-regular />
                </n-icon>
              </template>
            </n-button>
          </template>
        </partition-list>
      </file-dropper>
      <template #description>
        正在解析
      </template>
    </n-spin>

    <n-flex align="center" :size="32">
      <n-flex :style="{ width: 'auto', flex: '1 1 auto' }">
        <template v-if="status == 'flashing'">
          <n-progress type="line" :percentage="progress" />
        </template>
        <template v-else-if="status == 'success'">
          <n-element :class="$style.result" :style="{ color: 'var(--success-color)' }">
            烧录成功
          </n-element>
        </template>
        <template v-else-if="status == 'error'">
          <n-element :class="$style.result" :style="{ color: 'var(--error-color)' }">
            烧录异常
          </n-element>
          <n-button secondary round size="small">
            查看日志
          </n-button>
        </template>
      </n-flex>

      <n-button v-if="status == 'flashing'" size="large" :style="{ flex: '0 0 140px' }" @click="stopFlash">
        停止
      </n-button>
      <n-button v-else size="large" type="primary" :disabled="selectedPort == null || partitions.length == 0 || busy"
        :style="{ flex: '0 0 140px' }" @click="startFlash">
        开始烧录
      </n-button>
    </n-flex>
  </n-flex>
</template>

<script lang="ts" setup>
import { computed, ref, useCssModule, watch } from 'vue';
import {
  NButton,
  NElement,
  NFlex,
  NIcon,
  NProgress,
  NSelect,
  NSpin,
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

const busy = ref(false);
const status = ref<null | 'flashing' | 'success' | 'error'>(null);

async function fetchInfo() {
  busy.value = true;

  await cskburn(selectedPort.value!, 1500000, [], {
    onChipId(id) {
      chipId.value = id;
    },
    onFlashId(id, size) {
      flashId.value = `${id} (${Math.round(size / 1024 / 1024)} MB)`;
    },
  });

  busy.value = false;
}

const output = ref('');
const currentIndex = ref<number | null>(null);
const currentProgress = ref<number | null>(null);

const progress = ref(0);

let aborter: AbortController | undefined;

async function startFlash() {
  const args = ['--verify-all'];
  for (const part of partitions.value) {
    args.push(part.addr.toString(), part.file.path);
  }

  aborter = new AbortController();

  status.value = 'flashing';

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
    },
    onProgress(index, progress) {
      currentIndex.value = index;
      currentProgress.value = progress;
    },
  });

  output.value = result.output;
  status.value = result.code == 0 ? 'success' : 'error';
}

function stopFlash() {
  aborter?.abort();
  status.value = null;
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
