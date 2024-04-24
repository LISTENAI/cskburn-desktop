<template>
  <n-element>
    <n-data-table :columns="columns" :data flex-height size="small" :style="{ height: '100%' }" />
  </n-element>
</template>

<script lang="ts" setup>
import { computed, h, type Component } from 'vue';
import { NDataTable, NElement, type DataTableColumns } from 'naive-ui';
import type { IPartition } from '@/utils/images';

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

type IDataItem = {
  type: 'partition';
  partition: IPartition;
} | {
  type: 'footer';
};

const columns: DataTableColumns<IDataItem> = [
  {
    title: '#',
    key: 'index',
    align: 'right',
    width: '3em',
    colSpan(item, _index) {
      return item.type == 'footer' ? columns.length : 1
    },
    render(item, index) {
      if (item.type == 'partition') {
        return index + 1;
      } else if (slots.append) {
        return h(slots.append);
      }
    },
  },
  {
    title: '文件',
    key: 'name',
    render(item, _index) {
      if (item.type == 'partition') {
        return h(FieldName, { name: item.partition.file.name });
      }
    },
  },
  {
    title: '地址',
    key: 'addr',
    width: '8em',
    render(item, _index) {
      if (item.type == 'partition') {
        return h(FieldAddr, { addr: item.partition.addr });
      }
    },
  },
  {
    title: '大小',
    key: 'size',
    align: 'right',
    width: '8em',
    render(item, _index) {
      if (item.type == 'partition') {
        return h(FieldSize, { size: item.partition.file.size });
      }
    },
  },
  {
    title: '进度',
    key: 'progress',
    align: 'right',
    width: '6em',
    render(item, index) {
      if (item.type != 'partition') {
        return undefined;
      }

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
      if (item.type == 'partition' && slots.actions) {
        return h(slots.actions, { index, item: item.partition });
      }
    },
  },
];

const data = computed(() => {
  if (props.partitions.length === 0) {
    return [];
  } else {
    return [
      ...props.partitions.map((partition) => ({
        type: 'partition',
        partition,
      })),
      {
        type: 'footer',
      },
    ];
  }
});
</script>
