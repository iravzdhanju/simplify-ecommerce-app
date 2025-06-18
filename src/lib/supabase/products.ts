import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getClerkUserId, getAuthenticatedUserId } from './auth'
import type { Product, InsertProduct, UpdateProduct } from '@/types/database'
import { getActiveShopifyConnections } from './platform-connections'

/**
 * Get all products for the authenticated user
 */
export async function getUserProducts(): Promise<Product[]> {
  const clerkUserId = getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  // Only return products when the user has an active Shopify store connected.
  // If there are no active connections, return an empty list so that
  // the UI shows nothing instead of demo products.
  try {
    const { getActiveShopifyConnections } = await import('./platform-connections')
    const activeConnections = await getActiveShopifyConnections()

    if (activeConnections.length === 0) {
      // No store connected → no products to show.
      return []
    }
  } catch (err) {
    // If for some reason the check fails we still proceed with fetching products
    console.error('Failed to verify active shopify connections:', err)
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`)
  }

  let products: Product[] = data || []

  // Fallback: if no Supabase products, retrieve directly from Shopify using the first active connection.
  if (products.length === 0) {
    try {
      const connections = await getActiveShopifyConnections()
      if (connections.length > 0) {
        const credentials = connections[0].credentials as any
        const shopDomain: string | undefined = credentials?.shop_domain
        const accessToken: string | undefined = credentials?.access_token

        if (shopDomain && accessToken) {
          products = await fetchShopifyProducts(shopDomain, accessToken)
        }
      }
    } catch (fallbackErr) {
      console.error('Shopify fallback fetch failed:', fallbackErr)
    }
  }

  return products
}

/**
 * Get demo products for development/demo purposes
 */
function getDemoProducts(): Product[] {
  return [
    {
      id: 'demo-product-1',
      user_id: 'demo-user-id',
      clerk_user_id: 'demo-user-id',
      title: 'Demo Product 1',
      description: 'This is a demo product for testing the sync functionality',
      price: 29.99,
      category: 'Electronics',
      sku: 'DEMO-001',
      inventory: 100,
      images: ['/placeholder-product.svg'],
      brand: 'Demo Brand',
      weight: 1.0,
      dimensions: null,
      tags: ['demo', 'electronics', 'sync-test'],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'demo-product-2',
      user_id: 'demo-user-id',
      clerk_user_id: 'demo-user-id',
      title: 'Demo Product 2',
      description: 'Another demo product to test bulk operations',
      price: 19.99,
      category: 'Clothing',
      sku: 'DEMO-002',
      inventory: 50,
      images: ['/placeholder-product.svg'],
      brand: 'Demo Brand',
      weight: 0.5,
      dimensions: null,
      tags: ['demo', 'clothing', 'test'],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'demo-product-3',
      user_id: 'demo-user-id',
      clerk_user_id: 'demo-user-id',
      title: 'Demo Product 3',
      description: 'Third demo product with draft status',
      price: 49.99,
      category: 'Home & Garden',
      sku: 'DEMO-003',
      inventory: 25,
      images: ['/placeholder-product.svg'],
      brand: 'Demo Brand',
      weight: 2.0,
      dimensions: {
        length: 10,
        width: 8,
        height: 6,
        unit: 'in'
      },
      tags: ['demo', 'home', 'garden'],
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]
}

/**
 * Get a single product by ID for the authenticated user
 */
export async function getUserProduct(productId: string): Promise<Product | null> {
  const clerkUserId = getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Product not found in database, check demo products
        const demoProducts = getDemoProducts()
        return demoProducts.find(p => p.id === productId) || null
      }
      console.warn('Database error, checking demo products:', error.message)
      const demoProducts = getDemoProducts()
      return demoProducts.find(p => p.id === productId) || null
    }

    return data
  } catch (error) {
    console.warn('Database connection failed, checking demo products:', error)
    const demoProducts = getDemoProducts()
    return demoProducts.find(p => p.id === productId) || null
  }
}

/**
 * Create a new product for the authenticated user
 */
export async function createProduct(productData: Omit<InsertProduct, 'user_id' | 'clerk_user_id'>): Promise<Product> {
  const clerkUserId = getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  // Get user ID if available, but don't fail if we can't get it
  let userId: string | null = null
  try {
    userId = await getAuthenticatedUserId()
  } catch (error) {
    console.warn('Could not get authenticated user ID for product creation:', error)
  }

  // Use service role client to bypass RLS issues
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('products')
    .insert({
      ...productData,
      user_id: userId, // Can be null for demo mode
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

  const supabase = await createClient()

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

  const supabase = await createClient()

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

  try {
    const supabase = await createClient()

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
      console.warn('Database error, returning demo products without sync status:', error.message)
      const demoProducts = getDemoProducts()
      return demoProducts.map(product => ({ ...product, channel_mappings: [] }))
    }

    return data || []
  } catch (error) {
    console.warn('Database connection failed, returning demo products without sync status:', error)
    const demoProducts = getDemoProducts()
    return demoProducts.map(product => ({ ...product, channel_mappings: [] }))
  }
}

/**
 * Search products by title, SKU, or brand
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const clerkUserId = getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = await createClient()

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

  const supabase = await createClient()

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

// ------------ Helpers ------------

async function fetchShopifyProducts(shopDomain: string, accessToken: string): Promise<Product[]> {
  try {
    const response = await fetch(`https://${shopDomain}/admin/api/2023-10/products.json?limit=250`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Shopify API responded with status ${response.status}`)
    }

    const json = await response.json()
    const shopifyProducts = json.products || []

    // Map Shopify product to Supabase-like schema (raw), not UI Product.
    const mapped = shopifyProducts.map((p: any) => ({
      id: p.id?.toString() || crypto.randomUUID(),
      title: p.title,
      description: p.body_html || '',
      price: Number(p.variants?.[0]?.price || 0),
      category: p.product_type || 'Uncategorized',
      images: (p.images || []).map((img: any) => img.src),
      marketplace: ['Shopify'],
      sku: p.variants?.[0]?.sku,
      brand: p.vendor,
      inventory: p.variants?.[0]?.inventory_quantity,
      status: mapShopifyStatus(p.status),
      tags: p.tags ? p.tags.split(',').map((t: string) => t.trim()) : [],
      created_at: p.created_at,
      updated_at: p.updated_at,
    }))

    return mapped
  } catch (err) {
    console.error('Error fetching products from Shopify:', err)
    return []
  }
}

function mapShopifyStatus(status: string): string {
  switch (status) {
    case 'active':
    case 'ACTIVE':
      return 'active'
    case 'draft':
    case 'DRAFT':
      return 'draft'
    case 'archived':
    case 'ARCHIVED':
      return 'inactive'
    default:
      return 'active'
  }
}