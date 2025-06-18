'use client';

import { DataTableToolbar } from './data-table-toolbar';
import { useDataTableStore } from '@/stores/data-table-store';

export default function ConnectedDataTableToolbar() {
  const table = useDataTableStore((state) => state.table);

  if (!table) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <DataTableToolbar table={table as any} />;
}
