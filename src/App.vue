<template>
  <n-flex vertical :size="16" :style="{
    boxSizing: 'border-box',
    height: '100vh',
    padding: '16px'
  }">
    <app-settings v-model:show="settingsShown" />
    <auto-updater />
    <error-dialog v-model:show="errorDialogShown" :failure :output :header-title="errorDialogTitle" />
    <zero-address-confirm :show="zeroConfirmShown" @continue="() => resolveZeroConfirm('continue')"
      @skip="() => resolveZeroConfirm('skip')" @cancel="() => resolveZeroConfirm('cancel')" />

    <n-spin :show="busyForInfo || rebootingToRecovery" :style="{ width: 'fit-content' }">
      <n-flex vertical>
        <n-flex align="center" size="large">
          <n-flex align="center">
            <div>端口:</div>
            <port-selector v-model:selected="selectedPort" :available-serial-ports="availableSerialPorts"
              :available-adb-devices="availableAdbDevices" :disabled="busyForInfo || busyForFlash"
              :style="{ width: '400px' }" />
          </n-flex>
          <template v-if="selectedPort?.type === 'adb' && selectedPort.state === 'DEVICE'">
            <n-button secondary :disabled="busyForInfo || busyForFlash || rebootingToRecovery"
              @click="doAdbRebootToRecovery">
              进入 Recovery 模式
            </n-button>
          </template>
          <n-flex v-else-if="selectedPort?.type === 'serial'" align="center">
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
            Flash: {{ Math.round(flashInfo.size / 1024 / 1024) }} MB
            <template v-if="flashInfo.id">
              (<selectable-text selectable>{{ flashInfo.id }}</selectable-text>)
            </template>
          </div>
        </n-flex>
      </n-flex>
    </n-spin>

    <partition-view v-model:images="images" :busy="busyForFlash" :progress :errors :is-adb="isAdbPort"
      :style="{ flex: '1 1 auto' }" />

    <log-view v-if="outputShown" :logs="output.join('\n')" :style="{ height: '200px' }" />

    <n-flex align="center" :wrap="false">
      <n-flex align="center" :style="{ flex: '1 1 auto', minWidth: '0' }">
        <template v-if="status === FlashStatus.CONNECTING">
          <n-spin size="small" />
        </template>
        <template v-else-if="status === FlashStatus.FLASHING || status === FlashStatus.VERIFYING">
          <n-progress type="line" :percentage="progress.progress * 100" :show-indicator="false"
            :processing="status === FlashStatus.VERIFYING" />
        </template>
        <template v-else-if="status === FlashStatus.SUCCESS">
          <n-text :class="$style.result" type="success">
            烧录成功
          </n-text>
        </template>
        <template v-else-if="status === FlashStatus.ERROR">
          <n-button text :class="$style.result" type="error" :focusable="false" @click="openErrorDialog">
            <template v-if="failure?.code">
              烧录异常 [{{ failure.code }}]
            </template>
            <template v-else>
              烧录异常
            </template>
          </n-button>
        </template>
      </n-flex>

      <n-flex align="center" :wrap="false" :style="{ flex: '0 0 auto' }">
        <n-tooltip :disabled="busyForFlash">
          <template #trigger>
            <n-button quaternary type="default" :focusable="false" :disabled="busyForFlash"
              @click="() => settingsShown = true">
              <template #icon>
                <n-icon>
                  <Settings16Filled />
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
import { List16Regular, Settings16Filled } from '@vicons/fluent';

import { MODELS, normalizeModelName } from '@/utils/model';
import type { IFlashImage } from '@/utils/images';
import { cskburn, CSKBurnTerminatedError, CSKBurnUnnormalExitError, DEFAULT_BAUD_RATE } from '@/utils/cskburn';
import {
  ADBTransferTerminatedError,
  ADBTransferUnnormalExitError,
  computeMd5 as computeRemoteMd5,
  fetchChipId,
  fetchFlashSize,
  pushFile,
  rebootToRecovery,
  rebootToSystem,
} from '@/utils/adb';
import { cleanUpTmpFiles, computeMd5 as computeLocalMd5 } from '@/utils/file';

import { busyOn } from '@/composables/busyOn';
import { useAvailableAdbDevices, useAvailableSerialPorts } from '@/composables/devices';
import { FlashStatus } from '@/composables/progress';
import { useHexImage, usePartitions } from '@/composables/partitions';
import { useFlashSession } from '@/composables/useFlashSession';
import { useListen } from '@/composables/tauri/useListen';
import { bindProgressBar } from '@/composables/tauri/window';
import { useSettings } from '@/composables/tauri/settings';

import AppSettings from '@/components/sections/AppSettings.vue';
import AutoUpdater from '@/components/sections/AutoUpdater.vue';
import ErrorDialog from '@/components/sections/ErrorDialog.vue';
import PortSelector, { type IPortSelection } from '@/components/sections/PortSelector.vue';
import PartitionView from '@/components/sections/PartitionView.vue';
import LogView from '@/components/sections/LogView.vue';
import ZeroAddressConfirm from '@/components/sections/ZeroAddressConfirm.vue';

import SelectableText from '@/components/common/SelectableText.vue';

const baudrate = useSettings<number>('serialBaudRate', DEFAULT_BAUD_RATE);

const availableSerialPorts = useAvailableSerialPorts();
const availableAdbDevices = useAvailableAdbDevices();

const supportedChips: SelectOption[] = MODELS.map((model) => ({
  value: model.name,
  label: model.brandName,
}));

const selectedPort = ref<IPortSelection | null>(null);
const selectedChip = ref<string | null>(null);
const images = ref<IFlashImage[]>([]);

const isAdbPort = computed(() => selectedPort.value?.type === 'adb');

const {
  status,
  failure,
  output,
  chipId,
  flashInfo,
  progress,
  busyForFlash,
  resetForFlash,
  resetForInfo,
  stopFlash,
  handleFlashSuccess,
  handleFlashError,
} = useFlashSession(images);

const flashSize = computed(() => flashInfo.value?.size ?? null);

const busyForInfo = ref(false);

const readyToFlash = computed(() =>
  selectedPort.value != null &&
  !(selectedPort.value.type === 'serial' && selectedChip.value == null) &&
  !(selectedPort.value.type === 'adb' && selectedPort.value.state !== 'RECOVERY') &&
  images.value.length > 0 &&
  (hexImage.value != null || partitions.value.some((p) => p.enabled)) &&
  !hasError.value);

const readyToFetchInfo = computed(() =>
  selectedPort.value != null &&
  !(selectedPort.value.type === 'serial' && selectedChip.value == null) &&
  !(selectedPort.value.type === 'adb' && selectedPort.value.state !== 'RECOVERY'));

const message = useMessage();

async function fetchInfo(): Promise<void> {
  if (selectedPort.value?.type === 'serial' && selectedChip.value != null) {
    await fetchInfoFromSerial(selectedPort.value.path, selectedChip.value);
  } else if (selectedPort.value?.type === 'adb' && selectedPort.value.state === 'RECOVERY') {
    await fetchInfoFromAdb(selectedPort.value.identifier);
  }
}

async function fetchInfoFromSerial(path: string, chip: string): Promise<void> {
  resetForInfo();
  output.value.push(`* port: ${path}`);
  output.value.push(`* baud: ${baudrate.value}`);
  output.value.push(`* chip: ${chip}`);

  try {
    await busyOn(cskburn(path, baudrate.value, chip, [], {
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
    if (e instanceof CSKBurnTerminatedError) {
      failure.value = { code: null, message: `烧录进程被终止 (信号 ${e.signal})` };
      output.value.push(`[获取信息失败: 终止信号 ${e.signal}]`);
    } else if (e instanceof CSKBurnUnnormalExitError) {
      failure.value = {
        code: e.errorCode ?? null,
        message: e.message || `烧录进程异常退出 (退出码 ${e.code})`,
      };
      const tag = e.errorCode ? `[${e.errorCode}] ` : '';
      output.value.push(`[获取信息失败: ${tag}${e.message || `退出码 ${e.code}`}]`);
    } else {
      failure.value = { code: null, message: `${e}` };
      output.value.push(`[获取信息失败: 发生异常 ${e}]`);
    }
    errorDialogTitle.value = '获取信息失败';
    errorDialogShown.value = true;
  }
}

async function fetchInfoFromAdb(identifier: string): Promise<void> {
  resetForInfo();

  try {
    await busyOn((async () => {
      output.value.push(`设备: ${identifier}`);

      output.value.push('[正在获取 Chip ID]');
      chipId.value = await fetchChipId(identifier);

      output.value.push('[正在获取 Flash 大小]');
      const size = await fetchFlashSize(identifier);
      flashInfo.value = size ? { size } : null;

      output.value.push(`[获取信息成功]`);
    })(), busyForInfo);
  } catch (e) {
    console.error(e);
    message.error('获取信息失败');
    output.value.push(`[获取信息失败: 发生异常 ${e}]`);
  }
}

const REBOOT_TO_RECOVERY_TIMEOUT = 10_000;

const rebootingToRecovery = ref(false);
let rebootToRecoveryTimeout: number | undefined;

async function doAdbRebootToRecovery(): Promise<void> {
  if (selectedPort.value?.type !== 'adb') {
    return;
  }

  rebootingToRecovery.value = true;
  rebootToRecoveryTimeout = setTimeout(() => {
    rebootingToRecovery.value = false;
    message.error('进入 Recovery 模式超时');
  }, REBOOT_TO_RECOVERY_TIMEOUT);

  try {
    await rebootToRecovery(selectedPort.value.identifier);
  } catch { }
}

watch(availableAdbDevices, (devices) => {
  if (rebootingToRecovery.value) {
    const device = devices.find((d) => d.state === 'RECOVERY');
    if (device) {
      rebootingToRecovery.value = false;
      clearTimeout(rebootToRecoveryTimeout);
      rebootToRecoveryTimeout = undefined;
      selectedPort.value = { type: 'adb', ...device };
    }
  }
});

const hexImage = useHexImage(images);
const partitions = usePartitions(images);

watch(images, () => {
  progress.current = null;
  status.value = null;
  failure.value = null;
});

const errorDialogShown = ref(false);
const errorDialogTitle = ref('烧录失败');

function openErrorDialog(): void {
  if (failure.value) {
    errorDialogShown.value = true;
  }
}

watch(failure, (failure) => {
  if (failure) {
    errorDialogTitle.value = '烧录失败';
    errorDialogShown.value = true;
  }
});

const lpkChip = computed(() => {
  const lpk = images.value.find((img) => img.format === 'lpk');
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
      if (!partition.enabled) {
        return undefined;
      }

      const start = partition.addr;
      const end = start + partition.file.size;

      for (const [otherIndex, other] of partitions.value.entries()) {
        if (otherIndex === index || !other.enabled) {
          continue;
        }

        const otherStart = other.addr;
        const otherEnd = otherStart + other.file.size;

        if (!(start >= otherEnd || end <= otherStart)) {
          return `与分区 #${otherIndex + 1} 重叠`;
        }
      }

      if (start % 4096 !== 0) {
        return '地址未 4K 对齐';
      }

      if (flashSize.value != null && end > flashSize.value) {
        return '超出 Flash 大小';
      }
    });
  }
});

const hasError = computed(() => errors.value.some((error) => !!error));

const outputShown = ref(false);

type ZeroConfirmAction = 'continue' | 'skip' | 'cancel';

const zeroConfirmShown = ref(false);
let zeroConfirmResolve: ((action: ZeroConfirmAction) => void) | null = null;

function promptZeroAddress(): Promise<ZeroConfirmAction> {
  zeroConfirmShown.value = true;
  return new Promise((resolve) => {
    zeroConfirmResolve = resolve;
  });
}

function resolveZeroConfirm(action: ZeroConfirmAction): void {
  zeroConfirmShown.value = false;
  const resolve = zeroConfirmResolve;
  zeroConfirmResolve = null;
  resolve?.(action);
}

function disableZeroAddressPartitions(): void {
  for (const image of images.value) {
    if (image.format === 'bin' && image.addr === 0) {
      image.enabled = false;
    } else if (image.format === 'lpk') {
      for (const part of image.file.partitions) {
        if (part.addr === 0) {
          part.enabled = false;
        }
      }
    }
  }
}

async function startFlash(): Promise<void> {
  if (images.value.length === 0) {
    return;
  }

  if (isAdbPort.value && !hexImage.value) {
    const zeroEnabled = partitions.value.some((p) => p.enabled && p.addr === 0);
    if (zeroEnabled) {
      const action = await promptZeroAddress();
      if (action === 'cancel') {
        return;
      }
      if (action === 'skip') {
        disableZeroAddressPartitions();
        if (!partitions.value.some((p) => p.enabled)) {
          return;
        }
      }
    }
  }

  const signal = resetForFlash();

  if (selectedPort.value?.type === 'serial' && selectedChip.value != null) {
    await startFlashOnSerial(selectedPort.value.path, selectedChip.value, signal);
  } else if (selectedPort.value?.type === 'adb' && selectedPort.value.state === 'RECOVERY') {
    await startFlashOnAdb(selectedPort.value.identifier, signal);
  }
}

async function startFlashOnSerial(path: string, chip: string, signal: AbortSignal): Promise<void> {
  const args = ['--verify-all'];
  const enabledIndices: number[] = [];
  if (hexImage.value) {
    args.push(hexImage.value.file.path);
  } else {
    for (const [index, partition] of partitions.value.entries()) {
      if (!partition.enabled) continue;
      enabledIndices.push(index);
      args.push(partition.addr.toString(), partition.file.path);
    }
  }

  output.value.push(`* port: ${path}`);
  output.value.push(`* baud: ${baudrate.value}`);
  output.value.push(`* chip: ${chip}`);
  status.value = FlashStatus.CONNECTING;

  try {
    await cskburn(path, baudrate.value, chip, args, {
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
        progress.current = { index: enabledIndices[index] ?? index, progress: 0 };
        status.value = FlashStatus.FLASHING;
      },
      onWrote(index) {
        progress.current = { index: enabledIndices[index] ?? index, progress: 1 };
        status.value = FlashStatus.VERIFYING;
      },
      onProgress(index, current) {
        progress.current = { index: enabledIndices[index] ?? index, progress: current };
      },
    });

    await handleFlashSuccess();
  } catch (e) {
    await handleFlashError(e, signal, CSKBurnTerminatedError, CSKBurnUnnormalExitError);
  }
}

async function startFlashOnAdb(identifier: string, signal: AbortSignal): Promise<void> {
  if (hexImage.value) {
    message.error('ADB 模式暂不支持烧录 HEX 文件');
    return;
  }

  output.value.push(`设备: ${identifier}`);

  try {
    output.value.push('[正在获取 Chip ID]');
    chipId.value = await fetchChipId(identifier);

    output.value.push('[正在获取 Flash 大小]');
    const size = await fetchFlashSize(identifier);
    flashInfo.value = size ? { size } : null;

    for (const [index, partition] of partitions.value.entries()) {
      if (!partition.enabled) continue;
      const { addr, file } = partition;
      output.value.push(`[正在烧录分区 #${index + 1}]`);

      progress.current = { index, progress: null };
      status.value = FlashStatus.FLASHING;

      const pushPath = `/RAW/NAND/${addr.toString(16)}`;
      output.value.push(`正在推送到设备路径: ${pushPath}`);
      await pushFile(identifier, file.path, pushPath, {
        signal,
        onOutput(line) {
          const trimmed = line.trim();
          if (trimmed) {
            output.value.push(trimmed);
          }
        },
      });

      progress.current = { index, progress: 1 };
      status.value = FlashStatus.VERIFYING;

      const readPath = `/RAW/NAND/${addr.toString(16)}/${file.size.toString(16)}`;
      output.value.push(`正在计算设备端 MD5: ${readPath}`);
      const remoteMd5 = await computeRemoteMd5(identifier, readPath);
      output.value.push(`- 设备端 MD5: ${remoteMd5}`);
      const localMd5 = await computeLocalMd5(file.path);
      output.value.push(`- 本地端 MD5: ${localMd5}`);
      output.value.push(remoteMd5 === localMd5 ? '- 一致' : '- 不一致');
      if (remoteMd5 !== localMd5) {
        throw new Error(`分区 #${index + 1} 校验失败 (MD5 不一致)`);
      }
    }

    output.value.push('[正在复位设备]');
    await rebootToSystem(identifier);

    await handleFlashSuccess();
  } catch (e) {
    await handleFlashError(e, signal, ADBTransferTerminatedError, ADBTransferUnnormalExitError);
  }
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
  if (status === FlashStatus.STOPPED || status === FlashStatus.SUCCESS) {
    await getCurrentWindow().requestUserAttention(UserAttentionType.Informational);
  } else if (status === FlashStatus.ERROR) {
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
