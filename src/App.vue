<template>
  <n-flex vertical :size="16" :style="{
    boxSizing: 'border-box',
    height: '100vh',
    padding: '16px'
  }">
    <app-settings v-model:show="settingsShown" />
    <auto-updater />

    <n-spin :show="busyForInfo" :style="{ width: 'fit-content' }">
      <n-flex vertical>
        <n-flex align="center" size="large">
          <n-flex align="center">
            <div>端口:</div>
            <port-selector v-model:selected="selectedPort" :disabled="busyForInfo || busyForFlash"
              :style="{ width: '400px' }" />
          </n-flex>
          <template v-if="selectedPort?.type == 'adb' && selectedPort.state == 'DEVICE'">
            <n-button secondary :disabled="busyForInfo || busyForFlash" @click="rebootToRecovery">
              进入 Recovery 模式
            </n-button>
          </template>
          <n-flex v-else-if="selectedPort?.type == 'serial'" align="center">
            <div>芯片:</div>
            <n-select v-model:value="selectedChip" placeholder="请选择芯片" :options="supportedChips"
              :disabled="busyForInfo || busyForFlash" :style="{ width: '8em' }" />
          </n-flex>
        </n-flex>
        <n-flex align="center" size="large">
          <n-button secondary :disabled="!readyToFetchInfo || busyForInfo || busyForFlash" :style="{ width: '6em' }"
            @click="fetchInfo">
            获取信息
          </n-button>
          <div v-if="chipId">
            Chip ID: <selectable-text selectable>{{ chipId }}</selectable-text>
          </div>
          <div v-if="flashInfo">
            Flash ID: <selectable-text selectable>{{ flashInfo.id }}</selectable-text>
            ({{ Math.round(flashInfo.size / 1024 / 1024) }} MB)
          </div>
        </n-flex>
      </n-flex>
    </n-spin>

    <partition-view v-model:images="images" :busy="busyForFlash" :progress :errors :style="{ flex: '1 1 auto' }" />

    <log-view v-if="outputShown" :logs="output.join('\n')" :style="{ height: '200px' }" />

    <n-flex align="center" :wrap="false">
      <n-flex align="center" :style="{ flex: '1 1 auto', minWidth: '0' }">
        <template v-if="status == FlashStatus.CONNECTING">
          <n-spin size="small" />
        </template>
        <template v-else-if="status == FlashStatus.FLASHING || status == FlashStatus.VERIFYING">
          <n-progress type="line" :percentage="progress.progress * 100" :show-indicator="false"
            :processing="status == FlashStatus.VERIFYING" />
        </template>
        <template v-else-if="status == FlashStatus.SUCCESS">
          <n-text :class="$style.result" type="success">
            烧录成功
          </n-text>
        </template>
        <template v-else-if="status == FlashStatus.ERROR">
          <n-text :class="$style.result" type="error">
            <template v-if="failure">
              烧录异常：<selectable-text selectable>{{ failure }}</selectable-text>
            </template>
            <template v-else>
              烧录异常
            </template>
          </n-text>
        </template>
      </n-flex>

      <n-flex align="center" :wrap="false" :style="{ flex: '0 0 auto' }">
        <n-tooltip>
          <template #trigger>
            <n-button quaternary type="default" :focusable="false" @click="() => settingsShown = true">
              <template #icon>
                <n-icon>
                  <Settings16Regular />
                </n-icon>
              </template>
            </n-button>
          </template>
          设置
        </n-tooltip>

        <n-tooltip>
          <template #trigger>
            <n-button quaternary :type="outputShown ? 'primary' : 'default'" :focusable="false"
              @click="() => outputShown = !outputShown">
              <template #icon>
                <n-icon>
                  <List16Regular />
                </n-icon>
              </template>
            </n-button>
          </template>
          <template v-if="outputShown">
            隐藏日志
          </template>
          <template v-else>
            显示日志
          </template>
        </n-tooltip>

        <n-button v-if="busyForFlash" size="large" :style="{ width: '140px' }" @click="stopFlash">
          停止
        </n-button>
        <n-button v-else size="large" type="primary" :disabled="!readyToFlash || busyForInfo"
          :style="{ width: '140px' }" @click="startFlash">
          开始烧录
        </n-button>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import {
  NButton,
  NFlex,
  NIcon,
  NProgress,
  NSelect,
  NSpin,
  NText,
  NTooltip,
  useMessage,
  type SelectOption,
} from 'naive-ui';
import { getCurrentWindow, ProgressBarStatus, UserAttentionType } from '@tauri-apps/api/window';
import { confirm } from '@tauri-apps/plugin-dialog';
import { List16Regular, Settings16Regular } from '@vicons/fluent';

import { MODELS, normalizeModelName } from '@/utils/model';
import type { IFlashImage } from '@/utils/images';
import { cskburn, CSKBurnTerminatedError, CSKBurnUnnormalExitError } from '@/utils/cskburn';
import { cleanUpTmpFiles } from '@/utils/file';
import { ADBTransferCancelledError, executeShell, pushFile } from '@/utils/adb';

import { busyOn } from '@/composables/busyOn';
import { FlashStatus, useFlashProgress } from '@/composables/progress';
import { useHexImage, usePartitions } from '@/composables/partitions';
import { useListen } from '@/composables/tauri/useListen';
import { useAppName, useAppVersion } from '@/composables/tauri/app';
import { bindProgressBar, bindTitle } from '@/composables/tauri/window';
import { useLogWriter } from '@/composables/logWriter';

import AppSettings from '@/components/sections/AppSettings.vue';
import AutoUpdater from '@/components/sections/AutoUpdater.vue';
import PortSelector, { type IPortSelection } from '@/components/sections/PortSelector.vue';
import PartitionView from '@/components/sections/PartitionView.vue';
import LogView from '@/components/sections/LogView.vue';

import SelectableText from '@/components/common/SelectableText.vue';

const BAUDRATE = 1_500_000;

const supportedChips: SelectOption[] = MODELS.map((model) => ({
  value: model.name,
  label: model.brandName,
}));

const selectedPort = ref<IPortSelection | null>(null);
const selectedChip = ref<string | null>(null);
const images = ref<IFlashImage[]>([]);

const chipId = ref<string | null>(null);
const flashInfo = ref<{ id: string, size: number } | null>(null);

const flashSize = computed(() => flashInfo.value?.size ?? null);

const status = ref<FlashStatus | null>(null);
const failure = ref<string | null>(null);
const progress = useFlashProgress(images, status);

const busyForInfo = ref(false);
const busyForFlash = computed(() =>
  status.value == FlashStatus.CONNECTING ||
  status.value == FlashStatus.FLASHING ||
  status.value == FlashStatus.VERIFYING);

const readyToFlash = computed(() =>
  selectedPort.value != null &&
  !(selectedPort.value.type == 'serial' && selectedChip.value == null) &&
  images.value.length > 0 &&
  !hasError.value);

const readyToFetchInfo = computed(() =>
  selectedPort.value != null &&
  !(selectedPort.value.type == 'serial' && selectedChip.value == null));

const { logFileName, appendLog } = useLogWriter();

const message = useMessage();

async function fetchInfo(): Promise<void> {
  if (selectedPort.value?.type == 'serial' && selectedChip.value != null) {
    await fetchInfoFromSerial(selectedPort.value.path, selectedChip.value);
  }
}

async function fetchInfoFromSerial(path: string, chip: string): Promise<void> {
  chipId.value = null;
  flashInfo.value = null;
  output.value.splice(0);

  try {
    await busyOn(cskburn(path, BAUDRATE, chip, [], {
      onOutput(line) {
        output.value.push(line);
      },
      onChipId(id) {
        chipId.value = id;
      },
      onFlashId(id, size) {
        flashInfo.value = { id, size };
      },
    }), busyForInfo);

    output.value.push('[获取信息成功]');
  } catch (e) {
    console.error(e);
    message.error('获取信息失败');
    if (e instanceof CSKBurnTerminatedError) {
      output.value.push(`[获取信息失败: 终止信号 ${e.signal}]`);
    } else if (e instanceof CSKBurnUnnormalExitError) {
      if (e.message) {
        output.value.push(`[获取信息失败: ${e.message}]`);
      } else {
        output.value.push(`[获取信息失败: 退出码 ${e.code}]`);
      }
    } else {
      output.value.push(`[获取信息失败: 发生异常 ${e}]`);
    }
  }
}

async function rebootToRecovery(): Promise<void> {
  if (selectedPort.value?.type != 'adb') {
    return;
  }

  try {
    await executeShell(selectedPort.value.identifier, ['recovery']);
  } catch { }
}

const hexImage = useHexImage(images);
const partitions = usePartitions(images);

watch(images, () => {
  progress.current = null;
  status.value = null;
  failure.value = null;
});

const lpkChip = computed(() => {
  const lpk = images.value.find((img) => img.format == 'lpk');
  return lpk ? normalizeModelName(lpk.file.chip) : null;
});

watch(lpkChip, (chip) => {
  if (chip) {
    selectedChip.value = chip;
  }
});

const errors = computed(() => {
  if (hexImage.value) {
    // For now, we can only roughly compare the total size of all sections
    // against the flash size. The actual end address of the image is unknown,
    // as there's no straightforward way to compute relative offsets from
    // absolute RAM addresses.
    if (flashSize.value != null && hexImage.value.file.size > flashSize.value) {
      return ['超出 Flash 大小'];
    } else {
      return [];
    }
  } else {
    return partitions.value.map((partition, index) => {
      const start = partition.addr;
      const end = start + partition.file.size;

      for (const [otherIndex, other] of partitions.value.entries()) {
        if (otherIndex == index) {
          continue;
        }

        const otherStart = other.addr;
        const otherEnd = otherStart + other.file.size;

        if (!(start >= otherEnd || end <= otherStart)) {
          return `与分区 #${otherIndex + 1} 重叠`;
        }
      }

      if (start % 4096 != 0) {
        return '地址未 4K 对齐';
      }

      if (flashSize.value != null && end > flashSize.value) {
        return '超出 Flash 大小';
      }
    });
  }
});

const hasError = computed(() => errors.value.some((error) => !!error));

const output = ref<string[]>([]);
const outputShown = ref(false);

let aborter: AbortController | undefined;

async function startFlash(): Promise<void> {
  if (images.value.length == 0) {
    return;
  }

  aborter = new AbortController();

  if (selectedPort.value?.type == 'serial' && selectedChip.value != null) {
    await startFlashOnSerial(selectedPort.value.path, selectedChip.value, aborter.signal);
  } else if (selectedPort.value?.type == 'adb') {
    await startFlashOnAdb(selectedPort.value.identifier, aborter.signal);
  }
}

async function startFlashOnSerial(path: string, chip: string, signal: AbortSignal): Promise<void> {
  const args = ['--verify-all'];
  if (hexImage.value) {
    args.push(hexImage.value.file.path);
  } else {
    for (const partition of partitions.value) {
      args.push(partition.addr.toString(), partition.file.path);
    }
  }

  progress.current = null;
  output.value.splice(0);
  status.value = FlashStatus.CONNECTING;

  try {
    await cskburn(path, BAUDRATE, chip, args, {
      signal,
      onOutput(line) {
        output.value.push(line);
      },
      onChipId(id) {
        chipId.value = id;
      },
      onFlashId(id, size) {
        flashInfo.value = { id, size };
      },
      onPartition(index, _total, _addr) {
        progress.current = { index, progress: 0 };
        status.value = FlashStatus.FLASHING;
      },
      onWrote(index) {
        progress.current = { index, progress: 1 };
        status.value = FlashStatus.VERIFYING;
      },
      onProgress(index, current) {
        progress.current = { index, progress: current };
      },
    });

    status.value = FlashStatus.SUCCESS;
    output.value.push('[烧录成功]');

    await appendLog(chipId.value ?? 'UNKNOWN', 'SUCCESS');
  } catch (e) {
    console.error(e);
    if (e instanceof CSKBurnTerminatedError) {
      // @ts-ignore: changed elsewhere
      const stoppedManually = status.value == FlashStatus.STOPPED;
      if (stoppedManually) {
        output.value.push('[烧录停止]');
      } else {
        status.value = FlashStatus.ERROR;
        output.value.push(`[烧录失败: 终止信号 ${e.signal}]`);
      }
    } else if (e instanceof CSKBurnUnnormalExitError) {
      status.value = FlashStatus.ERROR;
      failure.value = e.message;
      output.value.push(`[烧录失败: 退出码 ${e.code}]`);
    } else {
      status.value = FlashStatus.ERROR;
      output.value.push(`[烧录失败: 发生异常 ${e}]`);
    }

    await appendLog(chipId.value ?? 'UNKNOWN', 'FAILURE');
  }
}

async function startFlashOnAdb(identifier: string, signal: AbortSignal): Promise<void> {
  if (hexImage.value) {
    throw new Error('ADB 模式下暂不支持 HEX 镜像');
  }

  progress.current = null;
  output.value.splice(0);

  try {
    status.value = FlashStatus.FLASHING;

    for (const [index, partition] of partitions.value.entries()) {
      progress.current = { index, progress: 0 };
      output.value.push(`adb -s ${identifier} push ${partition.file.path} /RAW/NAND/${partition.addr.toString(16)}`);
      await pushFile(identifier, partition.file.path, `/RAW/NAND/${partition.addr.toString(16)}`, (read, total) => {
        progress.current = { index, progress: read / total };
        output.value.push(`写入进度: ${read}/${total}`);
      }, signal);
      progress.current = { index, progress: 1 };
    }

    status.value = FlashStatus.SUCCESS;
    output.value.push('[烧录成功]');

    await appendLog(chipId.value ?? 'UNKNOWN', 'SUCCESS');
  } catch (e) {
    console.error(e);

    if (e instanceof ADBTransferCancelledError) {
      output.value.push('[烧录停止]');
    } else {
      status.value = FlashStatus.ERROR;
      failure.value = e instanceof Error ? e.message : String(e);
      output.value.push(`[烧录失败: 发生异常 ${e}]`);
    }

    await appendLog(chipId.value ?? 'UNKNOWN', 'FAILURE');
  }
}

function stopFlash(): void {
  status.value = FlashStatus.STOPPED;
  aborter?.abort();
}

bindProgressBar(() => {
  switch (status.value) {
    case FlashStatus.CONNECTING:
      return {
        status: ProgressBarStatus.Indeterminate,
        progress: 0,
      };
    case FlashStatus.FLASHING:
    case FlashStatus.VERIFYING:
      return {
        status: ProgressBarStatus.Normal,
        progress: Math.round(progress.progress * 100),
      };
    case FlashStatus.ERROR:
      return {
        status: ProgressBarStatus.Error,
      };
    case FlashStatus.STOPPED:
    case FlashStatus.SUCCESS:
    default:
      return {
        status: ProgressBarStatus.None,
      };
  }
});

watch(status, async (status) => {
  if (status == FlashStatus.STOPPED || status == FlashStatus.SUCCESS) {
    await getCurrentWindow().requestUserAttention(UserAttentionType.Informational);
  } else if (status == FlashStatus.ERROR) {
    await getCurrentWindow().requestUserAttention(UserAttentionType.Critical);
  }
});

useListen(() => getCurrentWindow().onCloseRequested(async (event) => {
  if (busyForFlash.value) {
    const confirmed = await confirm('正在烧录，退出软件会导致烧录被终止。确定要退出吗？', {
      okLabel: '确定',
      cancelLabel: '取消',
    });
    if (confirmed) {
      stopFlash();
    } else {
      event.preventDefault();
      return;
    }
  }

  await cleanUpTmpFiles();
}));

const settingsShown = ref(false);

const appName = useAppName();
const appVersion = useAppVersion();
bindTitle(() => {
  if (!appName.value || !appVersion.value) {
    return undefined;
  }

  if (logFileName.value) {
    return `${appName.value} - v${appVersion.value} (${logFileName.value})`;
  } else {
    return `${appName.value} - v${appVersion.value}`;
  }
});
</script>

<style lang="scss" module>
:global(body) {
  overflow: hidden;
  position: fixed;
  width: 100vw;
  height: 100vh;
  user-select: none;
  cursor: default;
}

.result {
  font-size: 1.2em;
  font-weight: bold;
  margin-left: 8px;
}
</style>
