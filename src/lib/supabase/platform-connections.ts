import { createClient } from '@/lib/supabase/server'
import { getClerkUserId, getAuthenticatedUserId } from './auth'
import { ensureUserInDatabase } from '@/lib/user-management'
import type {
  PlatformConnection,
  InsertPlatformConnection,
  UpdatePlatformConnection,
  ShopifyCredentials,
  ShopifyConfiguration,
  AmazonCredentials,
  AmazonConfiguration
} from '@/types/database'
import { Platform } from '@/types/database'

/**
 * Get all platform connections for the authenticated user
 */
export async function getUserPlatformConnections(): Promise<PlatformConnection[]> {
  const clerkUserId = await getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  console.log('Getting platform connections for clerk_user_id:', clerkUserId)

  // Use regular client with RLS - policies are configured for Clerk integration
  try {
    const supabase = await createClient()
    const { data: serviceData, error: serviceError } = await supabase
      .from('platform_connections')
      .select('*')
      .order('created_at', { ascending: false })

    if (serviceError) {
      throw new Error(`Service role query failed: ${serviceError.message}`)
    }

    console.log('Service role client returned connections:', serviceData?.length || 0)
    return serviceData || []
  } catch (error) {
    console.error('Database connection failed for platform connections:', error)
    throw error
  }
}

/**
 * Get platform connections by platform
 */
export async function getPlatformConnectionsByType(platform: Platform): Promise<PlatformConnection[]> {
  const clerkUserId = await getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  try {
    // Use regular client with RLS - policies are configured for Clerk integration
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('platform', platform)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn(`Database error fetching ${platform} connections:`, error.message)
      return []
    }

    console.log(`Found ${data?.length || 0} ${platform} connections`)
    return data || []
  } catch (error) {
    console.warn(`Database connection failed for ${platform} connections:`, error)
    return []
  }
}

/**
 * Get a specific platform connection
 */
export async function getPlatformConnection(connectionId: string): Promise<PlatformConnection | null> {
  const clerkUserId = await getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = await createClient()

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
  configuration: Partial<ShopifyConfiguration> | Partial<AmazonConfiguration> = {
    auto_sync: false,
    sync_inventory: true,
    sync_prices: true,
    sync_images: true,
  }
): Promise<PlatformConnection> {
  const clerkUserId = await getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  // Ensure user exists in database and get their record
  const user = await ensureUserInDatabase()
  if (!user) {
    throw new Error('Failed to create or find user record in database')
  }

  // TODO: Encrypt credentials before storing
  const encryptedCredentials = await encryptCredentials(credentials)

  // Use regular client with RLS - policies are configured for Clerk integration
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('platform_connections')
    .insert({
      user_id: user.id, // Use the actual database user_id
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
    // Handle duplicate key error - connection already exists
    if (error.message.includes('duplicate key')) {
      console.log('Connection already exists, updating last_connected timestamp')

      // Try to update the existing connection's last_connected time
      const { data: updateData, error: updateError } = await supabase
        .from('platform_connections')
        .update({
          last_connected: new Date().toISOString(),
          credentials: encryptedCredentials // Update credentials in case they changed
        })
        .eq('platform', platform)
        .eq('connection_name', connectionName)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update existing platform connection: ${updateError.message}`)
      }

      console.log('Successfully updated existing Shopify connection:', {
        id: updateData.id,
        platform: updateData.platform,
        connection_name: updateData.connection_name,
        clerk_user_id: updateData.clerk_user_id,
        shop_domain: (credentials as any).shop_domain
      })

      return updateData
    }

    throw new Error(`Failed to create platform connection: ${error.message}`)
  }

  console.log('Successfully created real Shopify connection:', {
    id: data.id,
    platform: data.platform,
    connection_name: data.connection_name,
    clerk_user_id: data.clerk_user_id,
    shop_domain: (credentials as any).shop_domain
  })

  return data
}

/**
 * Update a platform connection
 */
export async function updatePlatformConnection(
  connectionId: string,
  updateData: Partial<UpdatePlatformConnection>
): Promise<PlatformConnection> {
  const clerkUserId = await getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  // Use regular client with RLS - policies are configured for Clerk integration
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('platform_connections')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update platform connection: ${error.message}`)
  }

  return data as PlatformConnection
}

/**
 * Delete a platform connection
 */
export async function deletePlatformConnection(connectionId: string): Promise<void> {
  const clerkUserId = await getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  // Use regular client with RLS - policies are configured for Clerk integration
  const supabase = await createClient()

  const { error } = await supabase
    .from('platform_connections')
    .delete()
    .eq('id', connectionId)

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