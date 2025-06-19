import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProductsStore } from '@/stores/products-store';

export function useProducts() {
    const searchParams = useSearchParams();

    // Subscribe to individual store values for better performance
    const products = useProductsStore((state) => state.products);
    const totalProducts = useProductsStore((state) => state.totalProducts);
    const loading = useProductsStore((state) => state.loading);
    const error = useProductsStore((state) => state.error);
    const filters = useProductsStore((state) => state.filters);
    const setFilters = useProductsStore((state) => state.setFilters);
    const fetchProducts = useProductsStore((state) => state.fetchProducts);
    const refetch = useProductsStore((state) => state.refetch);
    const reset = useProductsStore((state) => state.reset);

    // Sync URL search params with store filters
    useEffect(() => {
        const page = searchParams.get('page')
            ? parseInt(searchParams.get('page')!)
            : 1;
        const search = searchParams.get('name') || undefined;
        const pageLimit = searchParams.get('perPage')
            ? parseInt(searchParams.get('perPage')!)
            : 10;
        const categories = searchParams.get('category') || undefined;
        const marketplaces = searchParams.get('marketplace') || undefined;

        const newFilters = {
            page,
            limit: pageLimit,
            ...(search && { search }),
            ...(categories && { categories }),
            ...(marketplaces && { marketplaces })
        };

        // Only update filters if they've actually changed
        const hasChanged =
            filters.page !== newFilters.page ||
            filters.limit !== newFilters.limit ||
            filters.search !== newFilters.search ||
            filters.categories !== newFilters.categories ||
            filters.marketplaces !== newFilters.marketplaces;

        if (hasChanged) {
            setFilters(newFilters);
        }
    }, [searchParams, filters, setFilters]);

    // Fetch products when filters change
    useEffect(() => {
        fetchProducts();
    }, [filters, fetchProducts]);

    return {
        products,
        totalProducts,
        loading,
        error,
        filters,
        refetch,
        reset
    };
} 