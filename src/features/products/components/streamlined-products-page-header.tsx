'use client';

import { buttonVariants } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { StreamlinedImportButton } from './streamlined-import-button';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useProductsActions } from '@/hooks/use-products-actions';

export function StreamlinedProductsPageHeader() {
  const { refetch } = useProductsActions();

  const handleImportComplete = () => {
    // Refresh the products data
    refetch();
  };

  return (
    <div className='flex items-start justify-between'>
      <Heading
        title='Products'
        description='Manage products with streamlined Shopify integration.'
      />
      <div className='flex gap-2'>
        <StreamlinedImportButton onImportComplete={handleImportComplete} />
        <Link
          href='/dashboard/product/new'
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <IconPlus className='mr-2 h-4 w-4' /> Add New
        </Link>
      </div>
    </div>
  );
}
