<template>
  <n-data-table :columns="columns" :data="props.partitions" flex-height size="small" :row-class-name="$style.rows" />
</template>

<script lang="ts" setup>
import { h } from 'vue';
import {
  NDataTable,
  type DataTableColumns,
} from 'naive-ui';
import type { IPartition } from '@/utils/images';

import FieldName from './FieldName.vue';
import FieldAddr from './FieldAddr.vue';
import FieldSize from './FieldSize.vue';

const props = defineProps<{
  partitions: IPartition[];
}>();

const columns: DataTableColumns<IPartition> = [
  {
    title: '文件',
    key: 'name',
    render: (item, _index) => h(FieldName, { path: item.path }),
  },
  {
    title: '地址',
    key: 'addr',
    width: '8em',
    render: (item, _index) => h(FieldAddr, { addr: item.addr }),
  },
  {
    title: '大小',
    key: 'size',
    align: 'right',
    width: '8em',
    render: (item, _index) => h(FieldSize, { size: item.size }),
  },
  {
    title: '进度',
    key: 'progress',
    align: 'right',
    width: '5em',
  }
];
</script>

<style lang="scss" module>
.rows {
  font-family: monospace;
}
</style>
