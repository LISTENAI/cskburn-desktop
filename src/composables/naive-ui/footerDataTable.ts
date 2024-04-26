import { h, type Component } from 'vue';
import type { DataTableBaseColumn, DataTableColumns } from 'naive-ui';

const FOOTER_ID = '__footer__';

type IFooter = { [FOOTER_ID]: true };

export function columnsWithFooter<T>(columns: DataTableColumns<T>, footer: Component | undefined): DataTableColumns<T> {
  const [first, ...rest] = columns;
  return [
    {
      ...first,
      colSpan(item, _index) {
        return (item as IFooter)[FOOTER_ID] ? columns.length : 1;
      },
      render(item, index) {
        if ((item as IFooter)[FOOTER_ID]) {
          return footer ? h(footer) : undefined;
        } else {
          return (first as DataTableBaseColumn).render?.(item as Record<string, unknown>, index);
        }
      },
    },
    ...rest,
  ] as DataTableColumns<T | IFooter>;
}

export function dataWithFooter<T>(data: T[]): (T | IFooter)[] {
  return [...data, { [FOOTER_ID]: true }];
}
