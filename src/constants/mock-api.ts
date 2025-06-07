////////////////////////////////////////////////////////////////////////////////
// 🚀 Real Product API - Connected to Supabase + Shopify Integration
////////////////////////////////////////////////////////////////////////////////

// Re-export the real API as the main interface
export { productsApi as fakeProducts } from '@/lib/api/products'
export type { Product } from '@/lib/api/products'

// Keep delay utility for any loading states
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))
