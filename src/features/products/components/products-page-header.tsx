'use client';

import { buttonVariants } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { ShopifyImportButton } from './shopify-import-button';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useProductsActions } from '@/hooks/use-products-actions';

export function ProductsPageHeader() {
  const { refetch } = useProductsActions();

  const handleImportComplete = () => {
    // Refresh the products data
    refetch();
  };

  return (
    <div className='flex items-start justify-between'>
      <Heading
        title='Products'
        description='Manage products (Server side table functionalities.)'
      />
      <div className='flex gap-2'>
        <ShopifyImportButton onImportComplete={handleImportComplete} />
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
