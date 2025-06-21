import { create } from 'zustand';
import { Product } from '@/lib/api/products';
import { productsApi } from '@/lib/api/products';

interface ProductFilters {
    page: number;
    limit: number;
    search?: string;
    categories?: string;
    marketplaces?: string;
    sort?: 'newest' | 'oldest';
}

interface ProductsStore {
    // State
    products: Product[];
    totalProducts: number;
    loading: boolean;
    error: string | null;
    filters: ProductFilters;

    // Actions
    setProducts: (products: Product[]) => void;
    setTotalProducts: (total: number) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setFilters: (filters: ProductFilters) => void;
    updateFilter: (key: keyof ProductFilters, value: any) => void;

    // Async actions
    fetchProducts: () => Promise<void>;
    refetch: () => Promise<void>;

    // Reset
    reset: () => void;
}

const initialState = {
    products: [],
    totalProducts: 0,
    loading: true,
    error: null,
    filters: {
        page: 1,
        limit: 10,
        sort: 'newest'
    } as ProductFilters,
};

export const useProductsStore = create<ProductsStore>((set, get) => ({
    ...initialState,

    // Synchronous actions
    setProducts: (products) => set({ products }),

    setTotalProducts: (totalProducts) => set({ totalProducts }),

    setLoading: (loading) => set({ loading }),

    setError: (error) => set({ error }),

    setFilters: (filters) => set({ filters }),

    updateFilter: (key, value) => {
        const currentFilters = get().filters;
        set({
            filters: {
                ...currentFilters,
                [key]: value,
                // Reset to page 1 when changing non-page filters
                ...(key !== 'page' && { page: 1 })
            }
        });
    },

    // Async actions
    fetchProducts: async () => {
        const { filters, setLoading, setError, setProducts, setTotalProducts } = get();

        try {
            setLoading(true);
            setError(null);

            const data = await productsApi.getProducts(filters as any);
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
    },

    refetch: async () => {
        const { fetchProducts } = get();
        await fetchProducts();
    },

    // Reset state
    reset: () => set(initialState),
})); 