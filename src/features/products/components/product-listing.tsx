'use client';

import { useMemo, memo } from 'react';
import { ProductTable } from './product-tables';
import { columns } from './product-tables/columns';
import { useProducts } from '@/hooks/use-products';

type ProductListingPage = {};

function ProductListingPageComponent({}: ProductListingPage) {
  const { products, totalProducts, loading, error } = useProducts();

  // Memoize the error component
  const errorComponent = useMemo(
    () => (
      <div className='flex h-64 items-center justify-center'>
        <div className='text-lg text-red-600'>Error: {error}</div>
      </div>
    ),
    [error]
  );

  if (error) {
    return errorComponent;
  }

  return (
    <ProductTable
      data={products}
      totalItems={totalProducts}
      columns={columns}
      isLoading={loading}
    />
  );
}

// Memoize and export the main component
export default memo(ProductListingPageComponent);
