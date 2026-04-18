import { computed, ref, type Ref } from 'vue';

import type { IFlashImage } from '@/utils/images';

import { FlashStatus, useFlashProgress } from './progress';

interface ITerminatedError {
  signal: number;
}

interface IUnnormalExitError {
  message: string;
  code: number;
  errorCode?: string | null;
}

export interface IFlashFailure {
  /** Structured cskburn error code, e.g. "E3001" / "D0A". `null` when the backend did not emit one. */
  code: string | null;
  /** Raw error message from the backend, suitable for display alongside the code. */
  message: string;
}

export function useFlashSession(images: Ref<IFlashImage[]>) {
  const status = ref<FlashStatus | null>(null);
  const failure = ref<IFlashFailure | null>(null);
  const output = ref<string[]>([]);
  const chipId = ref<string | null>(null);
  const flashInfo = ref<{ id?: string; size: number } | null>(null);

  const progress = useFlashProgress(images, status);

  let aborter: AbortController | undefined;

  const busyForFlash = computed(() =>
    status.value === FlashStatus.CONNECTING ||
    status.value === FlashStatus.FLASHING ||
    status.value === FlashStatus.VERIFYING);

  function resetForFlash(): AbortSignal {
    progress.current = null;
    failure.value = null;
    output.value.splice(0);
    aborter = new AbortController();
    return aborter.signal;
  }

  function resetForInfo(): void {
    chipId.value = null;
    flashInfo.value = null;
    output.value.splice(0);
  }

  function stopFlash(): void {
    status.value = FlashStatus.STOPPED;
    aborter?.abort();
  }

  async function handleFlashSuccess(): Promise<void> {
    status.value = FlashStatus.SUCCESS;
    output.value.push('[烧录成功]');
    aborter = undefined;
  }

  async function handleFlashError(
    e: unknown,
    signal: AbortSignal,
    TerminatedError: abstract new (...args: never[]) => ITerminatedError,
    UnnormalExitError: abstract new (...args: never[]) => IUnnormalExitError,
  ): Promise<void> {
    console.error(e);
    aborter = undefined;

    if (e instanceof TerminatedError) {
      if (signal.aborted) {
        output.value.push('[烧录停止]');
      } else {
        status.value = FlashStatus.ERROR;
        failure.value = { code: null, message: `烧录进程被终止 (信号 ${e.signal})` };
        output.value.push(`[烧录失败: 终止信号 ${e.signal}]`);
      }
    } else if (e instanceof UnnormalExitError) {
      status.value = FlashStatus.ERROR;
      failure.value = {
        code: e.errorCode ?? null,
        message: e.message || `烧录进程异常退出 (退出码 ${e.code})`,
      };
      output.value.push(`[烧录失败: 退出码 ${e.code}]`);
    } else {
      status.value = FlashStatus.ERROR;
      failure.value = { code: null, message: `${e}` };
      output.value.push(`[烧录失败: 发生异常 ${e}]`);
    }
  }

  return {
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
  };
}
