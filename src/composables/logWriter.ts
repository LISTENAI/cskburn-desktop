import { onBeforeUnmount, readonly, ref, watch, type Ref } from 'vue';
import { DateTime } from 'luxon';
import { FileHandle, open, remove } from '@tauri-apps/plugin-fs';

import { useSettings } from '@/composables/tauri/settings';
import { join } from '@tauri-apps/api/path';

export function useLogWriter(): ILogWriter {
  const fileName = ref<string>();
  const saveLogs = useSettings<boolean>('saveLogs');
  const logDir = useSettings<string>('logDir');

  let logFile: {
    path: string;
    handle: FileHandle;
    wrote: boolean;
  } | null = null;

  async function finalizeLog(): Promise<void> {
    if (logFile) {
      try {
        await logFile.handle.close();
        if (!logFile.wrote) {
          await remove(logFile.path);
        }
      } catch { }
      logFile = null;
    }
  }

  async function appendLog(uuid: string, result: 'SUCCESS' | 'FAILURE'): Promise<void> {
    if (!logFile) {
      return;
    }

    const now = DateTime.now().setZone('Asia/Shanghai');
    const line = `"${now.toFormat('yyyy-LL-dd HH:mm:ss')}","${uuid}","${result}"\r\n`;
    await logFile.handle.write(new TextEncoder().encode(line));
    logFile.wrote = true;
  }

  watch([saveLogs, logDir], async ([saveLogs, logDir]) => {
    if (saveLogs && logDir) {
      if (!fileName.value) {
        fileName.value = newFileName();
        const path = await join(logDir, fileName.value);
        logFile = {
          path,
          handle: await open(path, {
            append: true,
            create: true,
          }),
          wrote: false,
        };
        await logFile.handle.write(new TextEncoder().encode('"TIME","UUID","RESULT"\r\n'));
      }
    } else {
      fileName.value = undefined;
      await finalizeLog();
    }
  }, { immediate: true });

  onBeforeUnmount(() => finalizeLog());

  return {
    logFileName: readonly(fileName),
    appendLog,
  };
}

export interface ILogWriter {
  logFileName: Readonly<Ref<string | undefined>>;
  appendLog(uuid: string, result: 'SUCCESS' | 'FAILURE'): Promise<void>;
}

function newFileName(): string {
  const now = DateTime.now().setZone('Asia/Shanghai');
  return `${now.toFormat('yyyy-LL-dd_HH-mm-ss')}.csv`;
}
