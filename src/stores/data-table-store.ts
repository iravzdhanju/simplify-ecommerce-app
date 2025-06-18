import { create } from 'zustand';
import { type Table as TanstackTable } from '@tanstack/react-table';

interface DataTableStore {
    table: TanstackTable<any> | null;
    setTable: (table: TanstackTable<any>) => void;
}

export const useDataTableStore = create<DataTableStore>((set) => ({
    table: null,
    setTable: (table) => set({ table })
})); 