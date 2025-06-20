import PageContainer from '@/components/layout/page-container';
import { Separator } from '@/components/ui/separator';
import ProductListingPage from '@/features/products/components/product-listing';
import { ProductsPageHeader } from '@/features/products/components/products-page-header';
import { searchParamsCache, serialize } from '@/lib/searchparams';
import { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ConnectedDataTableToolbar = dynamic(
  () => import('@/components/ui/table/connected-data-table-toolbar')
);

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
        <ProductsPageHeader />
        <Separator />
        <ConnectedDataTableToolbar />
        <Suspense key={key}>
          <ProductListingPage />
        </Suspense>
      </div>
    </PageContainer>
  );
}
