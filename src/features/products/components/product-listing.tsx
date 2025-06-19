'use client';

import { useMemo, memo } from 'react';
import { ProductTable } from './product-tables';
import { columns } from './product-tables/columns';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { useProducts } from '@/hooks/use-products';

type ProductListingPage = {};

function ProductListingPageComponent({}: ProductListingPage) {
  const { products, totalProducts, loading, error } = useProducts();

  // Memoize the skeleton component to prevent unnecessary re-renders
  const loadingSkeleton = useMemo(
    () => (
      <DataTableSkeleton
        columnCount={7}
        rowCount={10}
        filterCount={3}
        withViewOptions={true}
        withPagination={true}
        cellWidths={['60px', 'auto', '120px', '140px', '100px', 'auto', '60px']}
      />
    ),
    []
  );

  // Memoize the error component
  const errorComponent = useMemo(
    () => (
      <div className='flex h-64 items-center justify-center'>
        <div className='text-lg text-red-600'>Error: {error}</div>
      </div>
    ),
    [error]
  );

  if (loading) {
    return loadingSkeleton;
  }

  if (error) {
    return errorComponent;
  }

  return (
    <ProductTable
      data={products}
      totalItems={totalProducts}
      columns={columns}
    />
  );
}

// Memoize and export the main component
export default memo(ProductListingPageComponent);
