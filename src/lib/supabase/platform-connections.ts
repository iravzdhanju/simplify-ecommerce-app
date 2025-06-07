import { createClient } from '@/lib/supabase/server'
import { getClerkUserId, getAuthenticatedUserId } from './auth'
import type { 
  PlatformConnection, 
  InsertPlatformConnection, 
  UpdatePlatformConnection,
  Platform,
  ShopifyCredentials,
  ShopifyConfiguration,
  AmazonCredentials,
  AmazonConfiguration
} from '@/types/database'

/**
 * Get all platform connections for the authenticated user
 */
export async function getUserPlatformConnections(): Promise<PlatformConnection[]> {
  // For MVP demo - return mock data instead of database
  return [
    {
      id: 'demo-connection-1',
      user_id: 'demo-user-id',
      clerk_user_id: 'demo-user-id',
      platform: 'shopify' as Platform,
      connection_name: 'Demo Shopify Store',
      credentials: {
        shop_domain: 'demo-store.myshopify.com',
        access_token: 'demo-token',
        scope: 'read_products,write_products'
      },
      configuration: {
        auto_sync: true,
        sync_inventory: true,
        sync_prices: true,
        sync_images: true
      },
      is_active: true,
      last_connected: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]
}

/**
 * Get platform connections by platform
 */
export async function getPlatformConnectionsByType(platform: Platform): Promise<PlatformConnection[]> {
  const clerkUserId = getClerkUserId()
  
  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .eq('platform', platform)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch ${platform} connections: ${error.message}`)
  }

  return data || []
}

/**
 * Get a specific platform connection
 */
export async function getPlatformConnection(connectionId: string): Promise<PlatformConnection | null> {
  const clerkUserId = getClerkUserId()
  
  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Connection not found
    }
    throw new Error(`Failed to fetch platform connection: ${error.message}`)
  }

  return data
}

/**
 * Create a new platform connection
 */
export async function createPlatformConnection(
  platform: Platform,
  connectionName: string,
  credentials: ShopifyCredentials | AmazonCredentials,
  configuration: ShopifyConfiguration | AmazonConfiguration = {}
): Promise<PlatformConnection> {
  const clerkUserId = getClerkUserId()
  const userId = await getAuthenticatedUserId()
  
  if (!clerkUserId || !userId) {
    throw new Error('User not authenticated')
  }

  // TODO: Encrypt credentials before storing
  const encryptedCredentials = await encryptCredentials(credentials)

  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('platform_connections')
    .insert({
      user_id: userId,
      clerk_user_id: clerkUserId,
      platform,
      connection_name: connectionName,
      credentials: encryptedCredentials,
      configuration,
      last_connected: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create platform connection: ${error.message}`)
  }

  return data
}

/**
 * Update a platform connection
 */
export async function updatePlatformConnection(
  connectionId: string,
  updateData: Partial<UpdatePlatformConnection>
): Promise<PlatformConnection> {
  const clerkUserId = getClerkUserId()
  
  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('platform_connections')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)
    .eq('clerk_user_id', clerkUserId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update platform connection: ${error.message}`)
  }

  return data
}

/**
 * Delete a platform connection
 */
export async function deletePlatformConnection(connectionId: string): Promise<void> {
  const clerkUserId = getClerkUserId()
  
  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = createClient()
  
  const { error } = await supabase
    .from('platform_connections')
    .delete()
    .eq('id', connectionId)
    .eq('clerk_user_id', clerkUserId)

  if (error) {
    throw new Error(`Failed to delete platform connection: ${error.message}`)
  }
}

/**
 * Test a platform connection
 */
export async function testPlatformConnection(connectionId: string): Promise<{
  success: boolean
  message: string
  data?: any
}> {
  const connection = await getPlatformConnection(connectionId)
  
  if (!connection) {
    return {
      success: false,
      message: 'Platform connection not found'
    }
  }

  try {
    // Decrypt credentials for testing
    const credentials = await decryptCredentials(connection.credentials)
    
    if (connection.platform === Platform.SHOPIFY) {
      const isValid = await testShopifyConnection(credentials as ShopifyCredentials)
      return {
        success: isValid,
        message: isValid ? 'Shopify connection is working' : 'Shopify connection failed',
        data: { platform: 'shopify', shop_domain: credentials.shop_domain }
      }
    } else if (connection.platform === Platform.AMAZON) {
      const isValid = await testAmazonConnection(credentials as AmazonCredentials)
      return {
        success: isValid,
        message: isValid ? 'Amazon connection is working' : 'Amazon connection failed',
        data: { platform: 'amazon' }
      }
    }
    
    return {
      success: false,
      message: 'Unsupported platform'
    }
  } catch (error) {
    console.error(`Failed to test ${connection.platform} connection:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed'
    }
  }
}

/**
 * Get a platform connection by ID (alias for getPlatformConnection)
 */
export async function getPlatformConnectionById(connectionId: string): Promise<PlatformConnection | null> {
  return getPlatformConnection(connectionId)
}

/**
 * Get active Shopify connections for user
 */
export async function getActiveShopifyConnections(): Promise<PlatformConnection[]> {
  return getPlatformConnectionsByType(Platform.SHOPIFY)
}

/**
 * Get active Amazon connections for user
 */
export async function getActiveAmazonConnections(): Promise<PlatformConnection[]> {
  return getPlatformConnectionsByType(Platform.AMAZON)
}

/**
 * Update connection last connected timestamp
 */
export async function updateLastConnected(connectionId: string): Promise<void> {
  await updatePlatformConnection(connectionId, {
    last_connected: new Date().toISOString(),
  })
}

/**
 * Deactivate a platform connection
 */
export async function deactivatePlatformConnection(connectionId: string): Promise<void> {
  await updatePlatformConnection(connectionId, {
    is_active: false,
  })
}

/**
 * Reactivate a platform connection
 */
export async function reactivatePlatformConnection(connectionId: string): Promise<void> {
  await updatePlatformConnection(connectionId, {
    is_active: true,
  })
}

// Utility functions for credential encryption/decryption
// TODO: Implement proper encryption using a secure method
async function encryptCredentials(credentials: any): Promise<any> {
  // For now, just return the credentials as-is
  // In production, implement proper encryption using a service like AWS KMS or similar
  console.warn('Credentials encryption not implemented - storing in plaintext')
  return credentials
}

async function decryptCredentials(encryptedCredentials: any): Promise<any> {
  // For now, just return the credentials as-is
  // In production, implement proper decryption
  return encryptedCredentials
}

// Platform-specific connection testing
async function testShopifyConnection(credentials: ShopifyCredentials): Promise<boolean> {
  try {
    // Test Shopify connection by making a simple API call
    const response = await fetch(`https://${credentials.shop_domain}/admin/api/2023-10/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': credentials.access_token,
        'Content-Type': 'application/json',
      },
    })
    
    return response.ok
  } catch (error) {
    console.error('Shopify connection test failed:', error)
    return false
  }
}

async function testAmazonConnection(credentials: AmazonCredentials): Promise<boolean> {
  try {
    // Test Amazon connection - this would need proper SP-API implementation
    // For now, just check if credentials exist
    return !!(credentials.seller_id && credentials.marketplace_id && credentials.access_token)
  } catch (error) {
    console.error('Amazon connection test failed:', error)
    return false
  }
}