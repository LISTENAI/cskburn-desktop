<template>
  <n-element>
    <data-table-with-footer :columns="columns" :data="props.partitions" flex-height size="small"
      :style="{ height: '100%' }">
      <template #footer>
        <component v-if="props.partitions.length > 0" :is="slots.footer" />
      </template>
    </data-table-with-footer>
  </n-element>
</template>

<script lang="ts" setup>
import { h, type Component } from 'vue';
import { NElement, type DataTableColumns } from 'naive-ui';
import type { IPartition } from '@/utils/images';

import DataTableWithFooter from '@/components/DataTableWithFooter.vue';

import FieldName from './FieldName.vue';
import FieldAddr from './FieldAddr.vue';
import FieldSize from './FieldSize.vue';
import FieldProgress from './FieldProgress.vue';

const props = defineProps<{
  partitions: IPartition[];
  currentIndex: number | null;
  currentProgress: number | null;
}>();

const slots = defineSlots<{
  append?: Component;
  actions?(props: { index: number, item: IPartition }): Component;
}>();

const columns: DataTableColumns<IPartition> = [
  {
    title: '#',
    key: 'index',
    align: 'right',
    width: '3em',
    render(_item, index) {
      return index + 1;
    },
  },
  {
    title: '文件',
    key: 'name',
    render(item, _index) {
      return h(FieldName, { name: item.file.name });
    },
  },
  {
    title: '地址',
    key: 'addr',
    width: '8em',
    render(item, _index) {
      return h(FieldAddr, { addr: item.addr });
    },
  },
  {
    title: '大小',
    key: 'size',
    align: 'right',
    width: '8em',
    render(item, _index) {
      return h(FieldSize, { size: item.file.size });
    },
  },
  {
    title: '进度',
    key: 'progress',
    align: 'right',
    width: '6em',
    render(_item, index) {
      if (props.currentIndex == null
        || props.currentProgress == null
        || props.currentIndex < index) {
        return '未开始';
      } else if (props.currentIndex == index) {
        return h(FieldProgress, { progress: props.currentProgress });
      } else if (props.currentIndex > index) {
        return h(FieldProgress, { progress: 1.0 });
      } else {
        return undefined;
      }
    },
  },
  {
    title: '',
    key: 'actions',
    align: 'right',
    width: '4em',
    render(item, index) {
      if (slots.actions) {
        return h(slots.actions, { index, item });
      }
    },
  },
];
</script>
