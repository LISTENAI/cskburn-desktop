<template>
  <data-table-with-footer :columns="slottedColumns(slots, columns)" :data="props.partitions" flex-height size="small">
    <template #footer>
      <component v-if="props.partitions.length > 0" :is="slots.footer" />
    </template>
  </data-table-with-footer>
</template>

<script lang="ts" setup>
import type { Component } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import type { IPartition } from '@/utils/images';
import { slottedColumns, type DataTableColumnSlots } from '@/utils/slottedDataTable';

import DataTableWithFooter from '@/components/DataTableWithFooter.vue';

const props = defineProps<{
  partitions: IPartition[];
}>();

type Keys = 'index' | 'name' | 'addr' | 'size' | 'progress' | 'actions';

const slots = defineSlots<{
  footer?: Component;
} & DataTableColumnSlots<Keys, IPartition>>();

const columns: DataTableColumns<IPartition> = [
  {
    title: '#',
    key: 'index',
    align: 'right',
    width: '3em',
  },
  {
    title: '文件',
    key: 'name',
  },
  {
    title: '地址',
    key: 'addr',
    width: '10em',
  },
  {
    title: '大小',
    key: 'size',
    align: 'right',
    width: '8em',
  },
  {
    title: '进度',
    key: 'progress',
    align: 'right',
    width: '6em',
  },
  {
    title: '',
    key: 'actions',
    align: 'right',
    width: '4em',
  },
];
</script>
