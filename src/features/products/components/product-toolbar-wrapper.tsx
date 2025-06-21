'use client';

import { useDataTable } from '@/hooks/use-data-table';
import { parseAsInteger, useQueryState } from 'nuqs';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTableSortSelect } from '@/components/ui/table/data-table-sort-select';
import { ColumnDef } from '@tanstack/react-table';
import { memo, useMemo } from 'react';

interface ProductTableToolbarWrapperProps<TData, TValue> {
  data: TData[];
  totalItems: number;
  columns: ColumnDef<TData, TValue>[];
}

function ProductTableToolbarWrapperComponent<TData, TValue>({
  data,
  totalItems,
  columns
}: ProductTableToolbarWrapperProps<TData, TValue>) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));

  // Memoize pageCount calculation
  const pageCount = useMemo(
    () => Math.ceil(totalItems / pageSize),
    [totalItems, pageSize]
  );

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    shallow: false,
    debounceMs: 500
  });

  return (
    <DataTableToolbar table={table}>
      <DataTableSortSelect />
    </DataTableToolbar>
  );
}

// Export memoized component
export const ProductTableToolbarWrapper = memo(
  ProductTableToolbarWrapperComponent
) as typeof ProductTableToolbarWrapperComponent;
