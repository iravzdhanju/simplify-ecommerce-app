'use client';

import type { Table } from '@tanstack/react-table';
import { Settings2 } from 'lucide-react';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import * as React from 'react';

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
}

export function DataTableViewOptions<TData>({
  table
}: DataTableViewOptionsProps<TData>) {
  const [, setVersion] = React.useState(0);
  const forceUpdate = React.useCallback(() => setVersion((v) => v + 1), []);

  const columns = React.useMemo(
    () =>
      table
        .getAllColumns()
        .filter(
          (column) =>
            typeof column.accessorFn !== 'undefined' && column.getCanHide()
        ),
    [table]
  );

  // Calculate visible columns each render (not memoised) so count stays in sync
  const visibleColumns = columns.filter((c) => c.getIsVisible()).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label='Toggle columns'
          role='combobox'
          variant='outline'
          size='sm'
          className='ml-auto hidden h-8 gap-1 lg:flex'
        >
          <Settings2 className='mr-1 h-4 w-4' />
          View
          <span className='text-muted-foreground text-xs'>
            ({visibleColumns})
          </span>
          <CaretSortIcon className='ml-1 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-44 p-0'>
        <Command>
          <CommandInput placeholder='Search columns...' />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  onSelect={() => {
                    // Toggle visibility and update UI after the table state propagates
                    column.toggleVisibility();
                    setTimeout(forceUpdate, 0);
                  }}
                >
                  <div
                    className={cn(
                      'border-primary mr-2 flex size-4 items-center justify-center rounded-sm border',
                      column.getIsVisible()
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {column.getIsVisible() && <CheckIcon className='size-3' />}
                  </div>
                  <span className='flex-1 truncate'>
                    {column.columnDef.meta?.label ?? column.id}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
