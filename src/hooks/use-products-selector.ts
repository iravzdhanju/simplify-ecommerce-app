import { useProductsStore } from '@/stores/products-store';

// Get the store type for proper typing
type ProductsStore = Parameters<typeof useProductsStore>[0] extends (state: infer U) => any ? U : never;

/**
 * Hook for selecting specific parts of the products state
 * Use this when you only need specific values to minimize re-renders
 * 
 * @example
 * const products = useProductsSelector(state => state.products);
 * const { loading, error } = useProductsSelector(state => ({ 
 *   loading: state.loading, 
 *   error: state.error 
 * }));
 */
export function useProductsSelector<T>(selector: (state: ProductsStore) => T): T {
    return useProductsStore(selector);
}

/**
 * Pre-built selectors for common use cases
 */
export const useProductsData = () => useProductsSelector(state => ({
    products: state.products,
    totalProducts: state.totalProducts,
}));

export const useProductsLoading = () => useProductsSelector(state => state.loading);

export const useProductsError = () => useProductsSelector(state => state.error);

export const useProductsFilters = () => useProductsSelector(state => state.filters); 