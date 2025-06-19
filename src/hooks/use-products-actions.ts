import { useProductsStore } from '@/stores/products-store';

/**
 * Hook that provides access to product store actions
 * Use this in components that only need to trigger actions
 * without subscribing to state changes (to avoid unnecessary re-renders)
 */
export function useProductsActions() {
    return {
        updateFilter: useProductsStore((state) => state.updateFilter),
        setFilters: useProductsStore((state) => state.setFilters),
        fetchProducts: useProductsStore((state) => state.fetchProducts),
        refetch: useProductsStore((state) => state.refetch),
        reset: useProductsStore((state) => state.reset),
    };
} 