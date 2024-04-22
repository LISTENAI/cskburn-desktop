<template>
  <n-data-table :columns="columns" :data="props.partitions" flex-height size="small" :row-class-name="$style.rows" />
</template>

<script lang="ts" setup>
import {
  NDataTable,
  type DataTableColumns,
} from 'naive-ui';
import { basename } from 'path';
import type { IPartition } from '@/utils/images';

const props = defineProps<{
  partitions: IPartition[];
}>();

const columns: DataTableColumns<IPartition> = [
  {
    title: '文件',
    key: 'name',
    render(item, _index) {
      return basename(item.path);
    },
  },
  {
    title: '地址',
    key: 'addr',
  },
  {
    title: '大小',
    key: 'size',
  },
];
</script>

<style lang="scss" module>
.rows {
  font-family: monospace;
}
</style>
