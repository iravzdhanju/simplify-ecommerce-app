import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import * as React from 'react';
import { useProductsStore } from '@/stores/products-store';

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' }
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export function DataTableSortSelect() {
  const sort = useProductsStore((s) => s.filters.sort ?? 'newest');
  const updateFilter = useProductsStore((s) => s.updateFilter);

  const currentLabel = sort === 'newest' ? 'Newest' : 'Oldest';

  const handleSelect = (value: SortValue) => {
    updateFilter('sort', value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='sm' className='flex items-center gap-1'>
          {currentLabel}
          <ChevronDownIcon className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {SORT_OPTIONS.map((opt) => {
          const isChecked = sort === opt.value;
          const Icon = opt.value === 'newest' ? ChevronDownIcon : ChevronUpIcon;

          return (
            <DropdownMenuCheckboxItem
              key={opt.value}
              className='[&_svg]:text-muted-foreground relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto'
              checked={isChecked}
              onClick={() => handleSelect(opt.value)}
            >
              <Icon />
              {opt.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
