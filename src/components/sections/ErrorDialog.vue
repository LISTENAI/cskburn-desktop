<template>
  <n-modal v-model:show="show" :style="{ maxWidth: '520px' }" :bordered="false">
    <n-card>
      <template #header>
        <n-flex align="center" :size="8">
          <n-icon :class="$style.headerIcon" size="22">
            <ErrorCircle24Filled />
          </n-icon>
          <span>{{ headerTitle }}</span>
          <n-tag v-if="failure?.code" type="error" size="small" round>
            {{ failure.code }}
          </n-tag>
        </n-flex>
      </template>

      <n-flex v-if="failure" vertical :size="12">
        <div v-if="info?.title" :class="$style.summary">
          {{ info.title }}
        </div>

        <div v-if="info?.hints?.length" :class="$style.section">
          <div :class="$style.sectionTitle">建议排查方向</div>
          <ul :class="$style.hintList">
            <li v-for="(hint, i) in info.hints" :key="i">{{ hint }}</li>
          </ul>
        </div>
        <div v-else :class="$style.section">
          <div :class="$style.sectionTitle">建议排查方向</div>
          <ul :class="$style.hintList">
            <li>请查看下方原始错误信息以获取更多细节。</li>
            <li>可在日志面板中查看完整的烧录输出。</li>
          </ul>
        </div>

        <n-collapse>
          <n-collapse-item title="原始错误信息" name="raw">
            <selectable-text selectable :class="$style.raw">
              <template v-if="failure.code">ERROR [{{ failure.code }}]: </template>{{ failure.message }}
            </selectable-text>
          </n-collapse-item>
        </n-collapse>
      </n-flex>

      <template #footer>
        <n-flex justify="end">
          <n-button v-if="output?.length" secondary size="medium" :loading="saving" @click="saveLog">
            保存日志
          </n-button>
          <n-button secondary size="medium" @click="close">关闭</n-button>
        </n-flex>
      </template>
    </n-card>
  </n-modal>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import {
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NFlex,
  NIcon,
  NModal,
  NTag,
  useMessage,
} from 'naive-ui';
import { ErrorCircle24Filled } from '@vicons/fluent';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

import SelectableText from '@/components/common/SelectableText.vue';

import { lookupErrorInfo } from '@/utils/cskburn-errors';
import type { IFlashFailure } from '@/composables/useFlashSession';

const props = defineProps<{
  failure: IFlashFailure | null;
  output?: string[];
  headerTitle?: string;
}>();

const show = defineModel<boolean>('show', { default: false });

const message = useMessage();
const saving = ref(false);

const info = computed(() => lookupErrorInfo(props.failure?.code));

const headerTitle = computed(() => props.headerTitle ?? '烧录失败');

function close() {
  show.value = false;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function defaultFileName(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `cskburn-${stamp}.log`;
}

function buildLogContent(): string {
  const lines: string[] = [];
  lines.push(`时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`);
  if (props.failure?.code) {
    lines.push(`错误码: ${props.failure.code}`);
  }
  if (props.failure?.message) {
    lines.push(`错误信息: ${props.failure.message}`);
  }
  lines.push('');
  lines.push('--- 烧录输出 ---');
  lines.push(...(props.output ?? []));
  return lines.join('\n');
}

async function saveLog(): Promise<void> {
  saving.value = true;
  try {
    const path = await save({
      title: '保存烧录日志',
      defaultPath: defaultFileName(),
      filters: [{ name: '日志文件', extensions: ['log', 'txt'] }],
    });
    if (!path) {
      return;
    }
    await writeTextFile(path, buildLogContent());
    message.success('日志已保存');
  } catch (e) {
    console.error(e);
    message.error(`保存日志失败: ${e}`);
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" module>
.headerIcon {
  color: var(--n-color-error, #d03050);
}

.summary {
  font-size: 1em;
  font-weight: 600;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sectionTitle {
  font-size: 0.85em;
  color: var(--n-text-color-3, #909399);
}

.hintList {
  margin: 0;
  padding-left: 1.2em;
  line-height: 1.6;
}

.raw {
  font-family: var(--font-family-mono);
  font-size: 0.85em;
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
