import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import {
  DataTableToolbarSkeleton,
  DataTableContentSkeleton,
  DataTablePaginationSkeleton
} from '@/components/ui/table/data-table-skeleton';
import ProductListingPage, {
  ProductListingToolbar
} from '@/features/products/components/product-listing';
import { searchParamsCache, serialize } from '@/lib/searchparams';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Products'
};

type pageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: pageProps) {
  const searchParams = await props.searchParams;
  // Allow nested RSCs to access the search params (in a type-safe way)
  searchParamsCache.parse(searchParams);

  // This key is used for invoke suspense if any of the search params changed (used for filters).
  const key = serialize({ ...searchParams });

  return (
    <PageContainer scrollable={false}>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-start justify-between'>
          <Heading
            title='Products'
            description='Manage products (Server side table functionalities.)'
          />
          <Link
            href='/dashboard/product/new'
            className={cn(buttonVariants(), 'text-xs md:text-sm')}
          >
            <IconPlus className='mr-2 h-4 w-4' /> Add New
          </Link>
        </div>
        <Separator />

        <div className='flex flex-1 flex-col space-y-4'>
          {/* Real Toolbar - Never refreshes */}
          <Suspense
            fallback={
              <DataTableToolbarSkeleton
                filterCount={3}
                withViewOptions={true}
              />
            }
          >
            <ProductListingToolbar />
          </Suspense>

          {/* Dynamic Table Content - Refreshes on filter changes */}
          <Suspense
            key={key}
            fallback={
              <div className='flex flex-1 flex-col space-y-4'>
                <DataTableContentSkeleton columnCount={7} rowCount={8} />
                <DataTablePaginationSkeleton />
              </div>
            }
          >
            <ProductListingPage />
          </Suspense>
        </div>
      </div>
    </PageContainer>
  );
}
