import { h, type Component } from 'vue';
import type { DataTableBaseColumn, DataTableColumns } from 'naive-ui';

export interface DataTableColumnSlotProps<T> {
  index: number;
  data: T;
}

export interface DataTableColumnSlot<T> {
  (props: DataTableColumnSlotProps<T>): Component;
}

export type DataTableColumnSlots<K extends string, T> = Record<`column-${K}`, DataTableColumnSlot<T>>;

type ColumnRenderer<T> = DataTableBaseColumn<T>['render'];

export function slottedRenderer<T>(slot: DataTableColumnSlot<T> | undefined): ColumnRenderer<T> {
  return (data, index) => slot ? h(slot, { index, data }) : undefined;
}

export function slottedColumns<K extends string, T>(
  slots: DataTableColumnSlots<K, T>,
  columns: DataTableColumns<T>
): DataTableColumns<T> {
  return columns.map((column) => {
    const key = (column as DataTableBaseColumn<T>).key;
    if (typeof key == 'string') {
      return {
        ...column,
        render: slottedRenderer(slots[`column-${key as K}`]),
      };
    } else {
      return column;
    }
  });
}
