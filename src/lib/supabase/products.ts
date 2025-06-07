import { createClient } from '@/lib/supabase/server'
import { getClerkUserId, getAuthenticatedUserId } from './auth'
import type { Product, InsertProduct, UpdateProduct } from '@/types/database'

/**
 * Get all products for the authenticated user
 */
export async function getUserProducts(): Promise<Product[]> {
  const clerkUserId = getClerkUserId()
  
  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`)
  }

  return data || []
}

/**
 * Get a single product by ID for the authenticated user
 */
export async function getUserProduct(productId: string): Promise<Product | null> {
  const clerkUserId = getClerkUserId()
  
  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Product not found
    }
    throw new Error(`Failed to fetch product: ${error.message}`)
  }

  return data
}

/**
 * Create a new product for the authenticated user
 */
export async function createProduct(productData: Omit<InsertProduct, 'user_id' | 'clerk_user_id'>): Promise<Product> {
  const clerkUserId = getClerkUserId()
  const userId = await getAuthenticatedUserId()
  
  if (!clerkUserId || !userId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('products')
    .insert({
      ...productData,
      user_id: userId,
      clerk_user_id: clerkUserId,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create product: ${error.message}`)
  }

  return data
}

/**
 * Update a product for the authenticated user
 */
export async function updateProduct(productId: string, productData: UpdateProduct): Promise<Product> {
  const clerkUserId = getClerkUserId()
  
  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('products')
    .update({
      ...productData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .eq('clerk_user_id', clerkUserId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update product: ${error.message}`)
  }

  return data
}

/**
 * Delete a product for the authenticated user
 */
export async function deleteProduct(productId: string): Promise<void> {
  const clerkUserId = getClerkUserId()
  
  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('clerk_user_id', clerkUserId)

  if (error) {
    throw new Error(`Failed to delete product: ${error.message}`)
  }
}

/**
 * Get products with their sync status across platforms
 */
export async function getProductsWithSyncStatus(): Promise<(Product & { channel_mappings: any[] })[]> {
  const clerkUserId = getClerkUserId()
  
  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      channel_mappings (
        id,
        platform,
        external_id,
        sync_status,
        last_synced,
        error_message,
        error_count
      )
    `)
    .eq('clerk_user_id', clerkUserId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch products with sync status: ${error.message}`)
  }

  return data || []
}

/**
 * Search products by title, SKU, or brand
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const clerkUserId = getClerkUserId()
  
  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .or(`title.ilike.%${query}%,sku.ilike.%${query}%,brand.ilike.%${query}%`)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to search products: ${error.message}`)
  }

  return data || []
}

/**
 * Get products by status
 */
export async function getProductsByStatus(status: string): Promise<Product[]> {
  const clerkUserId = getClerkUserId()
  
  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch products by status: ${error.message}`)
  }

  return data || []
}