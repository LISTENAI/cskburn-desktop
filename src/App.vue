<template>
  <n-flex vertical :class="$style.container" :size="16">
    <n-select :class="$style.port" v-model:value="selectedPort" :options="availableSelections" placeholder="选择一个串口设备" />
    <n-spin :class="$style.partitions" :content-class="$style.fullHeight" :show="parsing" :delay="200">
      <file-dropper @file-drop="handleFiles" :class="$style.fullHeight">
        <partition-list :class="$style.fullHeight" :partitions>
          <template #empty>
            <n-button quaternary round size="large" @click="handleFilePick">
              点击选择或将固件拖放至此
              <template #icon>
                <n-icon>
                  <add-12-regular />
                </n-icon>
              </template>
            </n-button>
          </template>
          <template #append>
            <n-button text block @click="handleFilePick">
              点击或拖放添加更多固件
              <template #icon>
                <n-icon>
                  <add-12-regular />
                </n-icon>
              </template>
            </n-button>
          </template>
          <template #actions="{ index }">
            <n-button quaternary circle size="small" @click="() => deletePartition(index)">
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
    <n-button :class="$style.footer" size="large" round type="primary" block>
      开始烧录
    </n-button>
  </n-flex>
</template>

<script lang="ts" setup>
import { computed, ref, useCssModule, watch } from 'vue';
import {
  NButton,
  NFlex,
  NIcon,
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

function deletePartition(index: number) {
  partitions.value.splice(index, 1);
}
</script>

<style lang="scss" module>
:global(html, body) {
  user-select: none;
}

.container {
  box-sizing: border-box;
  height: 100vh;
  padding: 16px;
}

.port {
  font-family: monospace;
}

.partitions {
  flex: 1 1 auto;
}

.fullHeight {
  height: 100%;
}
</style>
