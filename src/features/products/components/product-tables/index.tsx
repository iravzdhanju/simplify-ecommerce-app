'use client';

import { DataTable } from '@/components/ui/table/data-table';
import { useDataTableStore } from '@/stores/data-table-store';

import { useDataTable } from '@/hooks/use-data-table';

import { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, useQueryState } from 'nuqs';
import React, { memo, useMemo } from 'react';

interface ProductTableParams<TData, TValue> {
  data: TData[];
  totalItems: number;
  columns: ColumnDef<TData, TValue>[];
  isLoading?: boolean;
}

function ProductTableComponent<TData, TValue>({
  data,
  totalItems,
  columns,
  isLoading
}: ProductTableParams<TData, TValue>) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));

  // Memoize pageCount calculation
  const pageCount = useMemo(
    () => Math.ceil(totalItems / pageSize),
    [totalItems, pageSize]
  );

  const { table } = useDataTable({
    data, // product data
    columns, // product columns
    pageCount,
    shallow: false,
    debounceMs: 0,
    throttleMs: 0
  });

  // Store table instance for external toolbar.
  const setTable = useDataTableStore((s) => s.setTable);
  React.useEffect(() => {
    setTable(table);
  }, [table, setTable]);

  return <DataTable table={table} isLoading={isLoading} />;
}

// Export memoized component
export const ProductTable = memo(
  ProductTableComponent
) as typeof ProductTableComponent;
