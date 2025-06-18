'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/constants/data';
import { fakeProducts } from '@/constants/mock-api';
import { ProductTable } from './product-tables';
import { columns } from './product-tables/columns';
import { ProductTableToolbarWrapper } from './product-toolbar-wrapper';
import { useSearchParams } from 'next/navigation';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

type ProductListingPage = {};

export function ProductListingToolbar({}: ProductListingPage) {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const page = searchParams.get('page')
          ? parseInt(searchParams.get('page')!)
          : 1;
        const search = searchParams.get('name') || undefined;
        const pageLimit = searchParams.get('perPage')
          ? parseInt(searchParams.get('perPage')!)
          : 10;
        const categories = searchParams.get('category') || undefined;
        const marketplaces = searchParams.get('marketplace') || undefined;

        const filters = {
          page,
          limit: pageLimit,
          ...(search && { search }),
          ...(categories && { categories }),
          ...(marketplaces && { marketplaces })
        };

        const data = await fakeProducts.getProducts(filters);
        setProducts(data.products);
        setTotalProducts(data.total_products);
      } catch (error) {
        console.error('Error fetching products for toolbar:', error);
        setProducts([]);
        setTotalProducts(0);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [searchParams]);

  if (loading) {
    return (
      <DataTableSkeleton
        columnCount={7}
        rowCount={5}
        filterCount={2}
        withViewOptions={true}
        withPagination={false}
      />
    );
  }

  return (
    <ProductTableToolbarWrapper
      data={products}
      totalItems={totalProducts}
      columns={columns}
    />
  );
}

export default function ProductListingPage({}: ProductListingPage) {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const page = searchParams.get('page')
          ? parseInt(searchParams.get('page')!)
          : 1;
        const search = searchParams.get('name') || undefined;
        const pageLimit = searchParams.get('perPage')
          ? parseInt(searchParams.get('perPage')!)
          : 10;
        const categories = searchParams.get('category') || undefined;
        const marketplaces = searchParams.get('marketplace') || undefined;

        const filters = {
          page,
          limit: pageLimit,
          ...(search && { search }),
          ...(categories && { categories }),
          ...(marketplaces && { marketplaces })
        };

        const data = await fakeProducts.getProducts(filters);
        setProducts(data.products);
        setTotalProducts(data.total_products);
      } catch (error) {
        console.error('Error fetching products:', error);
        setError(
          error instanceof Error ? error.message : 'Failed to fetch products'
        );
        setProducts([]);
        setTotalProducts(0);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [searchParams]);

  if (loading) {
    return (
      <DataTableSkeleton
        columnCount={7}
        rowCount={10}
        filterCount={3}
        withViewOptions={true}
        withPagination={true}
        cellWidths={['60px', 'auto', '120px', '140px', '100px', 'auto', '60px']}
      />
    );
  }

  if (error) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='text-lg text-red-600'>Error: {error}</div>
      </div>
    );
  }

  return (
    <ProductTable
      data={products}
      totalItems={totalProducts}
      columns={columns}
    />
  );
}
