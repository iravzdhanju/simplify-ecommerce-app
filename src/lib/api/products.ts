/**
 * Real Product API Client
 * Connects to our Supabase backend with Shopify sync capabilities
 */

import { Product as SupabaseProduct } from '@/types/database'
import { apiRequest } from '@/lib/api-url'

// Transform Supabase product to match existing UI expectations
export type Product = {
  photo_url: string
  name: string
  description: string
  created_at: string
  price: number
  id: string // UUID instead of number
  category: string
  updated_at: string
  marketplace: ('Shopify' | 'Amazon')[] // Required for table columns
  // Enhanced fields from Shopify integration
  sku?: string
  brand?: string
  inventory?: number
  status: string
  tags: string[]
  images: string[]
  // Sync status
  sync_status?: {
    shopify?: 'pending' | 'syncing' | 'success' | 'error'
    last_synced?: string
    error_message?: string
  }
}

interface ProductsResponse {
  success: boolean
  time: string
  message: string
  total_products: number
  offset: number
  limit: number
  products: Product[]
}

interface ProductResponse {
  success: boolean
  time: string
  message: string
  product: Product
}

/**
 * Transform Supabase product to UI product format
 */
function transformProduct(supabaseProduct: any): Product {
  return {
    id: supabaseProduct.id,
    name: supabaseProduct.title ?? supabaseProduct.name ?? 'Untitled',
    description: supabaseProduct.description || '',
    price: supabaseProduct.price || 0,
    category: supabaseProduct.category || 'Uncategorized',
    photo_url: supabaseProduct.images?.[0] || '/placeholder-product.png',
    created_at: supabaseProduct.created_at,
    updated_at: supabaseProduct.updated_at,
    marketplace: supabaseProduct.marketplace || ['Shopify'], // Default marketplace
    sku: supabaseProduct.sku,
    brand: supabaseProduct.brand,
    inventory: supabaseProduct.inventory,
    status: supabaseProduct.status,
    tags: supabaseProduct.tags || [],
    images: supabaseProduct.images || [],
    // Add sync status if channel mappings exist
    sync_status: supabaseProduct.channel_mappings?.[0] ? {
      shopify: supabaseProduct.channel_mappings[0].sync_status,
      last_synced: supabaseProduct.channel_mappings[0].last_synced,
      error_message: supabaseProduct.channel_mappings[0].error_message,
    } : undefined,
  }
}

/**
 * Real Products API Client
 */
export const productsApi = {
  /**
   * Get all products with optional filtering and search
   */
  async getAll({
    categories = [],
    search,
  }: {
    categories?: string[]
    search?: string
  }): Promise<Product[]> {
    try {
      const response = await apiRequest('/api/products')

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch products')
      }

      let products: Product[] = data.data.map(transformProduct)

      // Apply client-side filtering for categories
      if (categories.length > 0) {
        products = products.filter((product) =>
          categories.includes(product.category)
        )
      }

      // Apply client-side search
      if (search) {
        const searchLower = search.toLowerCase()
        products = products.filter((product) =>
          product.name.toLowerCase().includes(searchLower) ||
          product.description.toLowerCase().includes(searchLower) ||
          product.category.toLowerCase().includes(searchLower) ||
          product.brand?.toLowerCase().includes(searchLower) ||
          product.sku?.toLowerCase().includes(searchLower)
        )
      }

      return products
    } catch (error) {
      console.error('Error fetching products:', error)
      throw error
    }
  },

  /**
   * Get paginated products with filtering and search
   */
  async getProducts({
    page = 1,
    limit = 10,
    categories,
    search,
  }: {
    page?: number
    limit?: number
    categories?: string
    search?: string
  }): Promise<ProductsResponse> {
    try {
      const categoriesArray = categories ? categories.split('.') : []
      const allProducts = await this.getAll({
        categories: categoriesArray,
        search,
      })

      const totalProducts = allProducts.length
      const offset = (page - 1) * limit
      const paginatedProducts = allProducts.slice(offset, offset + limit)

      return {
        success: true,
        time: new Date().toISOString(),
        message: 'Products fetched successfully',
        total_products: totalProducts,
        offset,
        limit,
        products: paginatedProducts,
      }
    } catch (error) {
      console.error('Error in getProducts:', error)
      return {
        success: false,
        time: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Failed to fetch products',
        total_products: 0,
        offset: 0,
        limit,
        products: [],
      }
    }
  },

  /**
   * Get a specific product by ID
   */
  async getProductById(id: string): Promise<ProductResponse> {
    try {
      const response = await apiRequest(`/api/products/${id}`)

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            time: new Date().toISOString(),
            message: `Product with ID ${id} not found`,
            product: {} as Product,
          }
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch product')
      }

      return {
        success: true,
        time: new Date().toISOString(),
        message: `Product with ID ${id} found`,
        product: transformProduct(data.data),
      }
    } catch (error) {
      console.error(`Error fetching product ${id}:`, error)
      return {
        success: false,
        time: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Failed to fetch product',
        product: {} as Product,
      }
    }
  },

  /**
   * Create a new product
   */
  async createProduct(productData: Partial<Product>): Promise<ProductResponse> {
    console.log('productData', productData)
    try {
      // Transform UI format back to Supabase format
      const supabaseFormat = {
        title: productData.name,
        description: productData.description,
        price: productData.price,
        category: productData.category,
        brand: productData.brand,
        sku: productData.sku,
        inventory: productData.inventory || 0,
        tags: productData.tags || [],
        images: productData.images || [],
        status: productData.status || 'draft',
      }

      const response = await apiRequest('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(supabaseFormat),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create product')
      }

      return {
        success: true,
        time: new Date().toISOString(),
        message: 'Product created successfully',
        product: transformProduct(data.data),
      }
    } catch (error) {
      console.error('Error creating product:', error)
      throw error
    }
  },

  /**
   * Update an existing product
   */
  async updateProduct(id: string, productData: Partial<Product>): Promise<ProductResponse> {
    try {
      // Transform UI format back to Supabase format
      const supabaseFormat = {
        title: productData.name,
        description: productData.description,
        price: productData.price,
        category: productData.category,
        brand: productData.brand,
        sku: productData.sku,
        inventory: productData.inventory,
        tags: productData.tags,
        images: productData.images,
        status: productData.status,
      }

      const response = await apiRequest(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(supabaseFormat),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to update product')
      }

      return {
        success: true,
        time: new Date().toISOString(),
        message: 'Product updated successfully',
        product: transformProduct(data.data),
      }
    } catch (error) {
      console.error(`Error updating product ${id}:`, error)
      throw error
    }
  },

  /**
   * Delete a product
   */
  async deleteProduct(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiRequest(`/api/products/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete product')
      }

      return {
        success: true,
        message: 'Product deleted successfully',
      }
    } catch (error) {
      console.error(`Error deleting product ${id}:`, error)
      throw error
    }
  },

  /**
   * Sync product to Shopify
   */
  async syncToShopify(productId: string, operation: 'create' | 'update' | 'delete' = 'create'): Promise<{
    success: boolean
    message: string
    data?: any
  }> {
    try {
      const response = await apiRequest('/api/sync/shopify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          operation,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      return {
        success: data.success,
        message: data.success ? 'Product synced to Shopify successfully' : data.error,
        data: data.data,
      }
    } catch (error) {
      console.error(`Error syncing product ${productId} to Shopify:`, error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to sync to Shopify',
      }
    }
  },

  /**
   * Get sync status for all products
   */
  async getSyncStatus(): Promise<{
    success: boolean
    data: {
      totalProducts: number
      syncedProducts: number
      pendingSync: number
      errorCount: number
    }
  }> {
    try {
      // This would call a dedicated sync status endpoint
      // For now, we'll calculate from the products data
      const products = await this.getAll({})

      const totalProducts = products.length
      const syncedProducts = products.filter(p => p.sync_status?.shopify === 'success').length
      const pendingSync = products.filter(p => !p.sync_status || p.sync_status.shopify === 'pending').length
      const errorCount = products.filter(p => p.sync_status?.shopify === 'error').length

      return {
        success: true,
        data: {
          totalProducts,
          syncedProducts,
          pendingSync,
          errorCount,
        },
      }
    } catch (error) {
      console.error('Error getting sync status:', error)
      return {
        success: false,
        data: {
          totalProducts: 0,
          syncedProducts: 0,
          pendingSync: 0,
          errorCount: 0,
        },
      }
    }
  },

  /**
   * Bulk import products from Shopify to local database
   */
  async bulkImportFromShopify(): Promise<{
    success: boolean
    message: string
    data: {
      imported: number
      skipped: number
      errors: string[]
    }
  }> {
    try {
      const response = await apiRequest('/api/sync/shopify/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      return {
        success: data.success,
        message: data.success ? data.message : data.error,
        data: data.data || {
          imported: 0,
          skipped: 0,
          errors: [data.error || 'Unknown error']
        },
      }
    } catch (error) {
      console.error('Error importing products from Shopify:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import from Shopify',
        data: {
          imported: 0,
          skipped: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        }
      }
    }
  },
}