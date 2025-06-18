'use client';

import { DataTable } from '@/components/ui/table/data-table';
import { useDataTableStore } from '@/stores/data-table-store';

import { useDataTable } from '@/hooks/use-data-table';

import { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, useQueryState } from 'nuqs';
import React from 'react';

interface ProductTableParams<TData, TValue> {
  data: TData[];
  totalItems: number;
  columns: ColumnDef<TData, TValue>[];
}

export function ProductTable<TData, TValue>({
  data,
  totalItems,
  columns
}: ProductTableParams<TData, TValue>) {
  const [pageSize] = useQueryState('perPage', parseAsInteger.withDefault(10));

  const pageCount = Math.ceil(totalItems / pageSize);

  const { table } = useDataTable({
    data, // product data
    columns, // product columns
    pageCount: pageCount,
    shallow: false,
    debounceMs: 0,
    throttleMs: 0
  });

  // Store table instance for external toolbar.
  const setTable = useDataTableStore((s) => s.setTable);
  React.useEffect(() => {
    setTable(table);
  }, [table, setTable]);

  return <DataTable table={table} />;
}
