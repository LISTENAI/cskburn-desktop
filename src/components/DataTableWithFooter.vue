<template>
  <n-data-table :columns :data />
</template>

<script lang="ts" setup>
import { computed, h, type Component } from 'vue';
import { NDataTable, type DataTableBaseColumn, type DataTableColumns } from 'naive-ui';

type IDataItem<T> = T | { footer: true };

const props = defineProps<{
  columns: DataTableColumns<any>;
  data: any[];
}>();

const slots = defineSlots<{
  footer?: Component;
}>();

const columns = computed(() => {
  const [first, ...rest] = props.columns;
  return [
    {
      ...first,
      colSpan(item, _index) {
        return item.footer ? props.columns.length : 1;
      },
      render(item, index) {
        if (item.footer) {
          return slots.footer ? h(slots.footer) : undefined;
        } else {
          return (first as DataTableBaseColumn).render?.(item, index);
        }
      },
    },
    ...rest,
  ] as DataTableColumns<IDataItem<any>>;
});

const data = computed(() => [...props.data, { footer: true }]);
</script>
