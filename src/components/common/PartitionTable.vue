<template>
  <n-data-table
    :columns="columnsWithFooter(slottedColumns(slots, columns), !isEmpty(props.partitions) ? slots.footer : undefined)"
    :data="dataWithFooter(props.partitions)" flex-height size="small" />
</template>

<script lang="ts" setup>
import type { Component } from 'vue';
import { NDataTable, type DataTableColumns } from 'naive-ui';
import { isEmpty } from 'radash';
import type { IPartition } from '@/utils/images';

import { columnsWithFooter, dataWithFooter } from '@/composables/naive-ui/footerDataTable';
import { slottedColumns, type DataTableColumnSlots } from '@/composables/naive-ui/slottedDataTable';

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
    width: '6em',
  },
];
</script>
