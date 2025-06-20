import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getClerkUserId } from './auth'
import {
  Platform,
  SyncStatus,
  SyncOperation,
  LogStatus
} from '@/types/database'
import type {
  ChannelMapping,
  InsertChannelMapping,
  UpdateChannelMapping,
  SyncLog,
  InsertSyncLog
} from '@/types/database'

/**
 * Get channel mappings for a product
 */
export async function getProductChannelMappings(productId: string): Promise<ChannelMapping[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('channel_mappings')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch channel mappings: ${error.message}`)
  }

  return data || []
}

/**
 * Create or update a channel mapping
 */
export async function upsertChannelMapping(
  productId: string,
  platform: Platform,
  mappingData: Partial<InsertChannelMapping>
): Promise<ChannelMapping> {
  // Use regular client with RLS - user should exist in database now
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('channel_mappings')
    .upsert({
      product_id: productId,
      platform,
      ...mappingData,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to upsert channel mapping: ${error.message}`)
  }

  return data
}

/**
 * Update sync status for a channel mapping
 */
export async function updateSyncStatus(
  productId: string,
  platform: Platform,
  status: SyncStatus,
  externalId?: string,
  errorMessage?: string
): Promise<void> {
  const supabase = await createClient()

  const updateData: UpdateChannelMapping = {
    sync_status: status,
    updated_at: new Date().toISOString(),
  }

  if (status === SyncStatus.SUCCESS) {
    updateData.last_synced = new Date().toISOString()
    updateData.error_count = 0
    updateData.error_message = null
    if (externalId) {
      updateData.external_id = externalId
    }
  } else if (status === SyncStatus.ERROR) {
    updateData.error_message = errorMessage
    // Increment error count
    const { data: existing } = await supabase
      .from('channel_mappings')
      .select('error_count')
      .eq('product_id', productId)
      .eq('platform', platform)
      .single()

    updateData.error_count = (existing?.error_count || 0) + 1
  }

  const { error } = await supabase
    .from('channel_mappings')
    .update(updateData)
    .eq('product_id', productId)
    .eq('platform', platform)

  if (error) {
    throw new Error(`Failed to update sync status: ${error.message}`)
  }
}

/**
 * Log a sync operation
 */
export async function logSyncOperation(
  productId: string,
  platform: Platform,
  operation: SyncOperation,
  status: LogStatus,
  options: {
    message?: string
    requestData?: any
    responseData?: any
    executionTime?: number
  } = {}
): Promise<SyncLog> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sync_logs')
    .insert({
      product_id: productId,
      platform,
      operation,
      status,
      message: options.message,
      request_data: options.requestData,
      response_data: options.responseData,
      execution_time: options.executionTime,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to log sync operation: ${error.message}`)
  }

  return data
}

/**
 * Get sync logs for a product
 */
export async function getProductSyncLogs(
  productId: string,
  platform?: Platform,
  limit: number = 50
): Promise<SyncLog[]> {
  const supabase = await createClient()

  let query = supabase
    .from('sync_logs')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (platform) {
    query = query.eq('platform', platform)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch sync logs: ${error.message}`)
  }

  return data || []
}

/**
 * Get all sync logs for user's products
 */
export async function getUserSyncLogs(limit: number = 100): Promise<SyncLog[]> {
  const clerkUserId = getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sync_logs')
      .select(`
        *,
        products!inner (
          id,
          title,
          clerk_user_id
        )
      `)
      .eq('products.clerk_user_id', clerkUserId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('Database error, returning empty sync logs:', error.message)
      return []
    }

    return data || []
  } catch (error) {
    console.warn('Database connection failed, returning empty sync logs:', error)
    return []
  }
}

/**
 * Get sync statistics for user
 */
export async function getUserSyncStats(): Promise<{
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
  lastSyncTime: string | null
}> {
  const clerkUserId = getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  try {
    const supabase = await createClient()

    // Get total syncs
    const { count: totalSyncs } = await supabase
      .from('sync_logs')
      .select('*, products!inner(clerk_user_id)', { count: 'exact', head: true })
      .eq('products.clerk_user_id', clerkUserId)

    // Get successful syncs
    const { count: successfulSyncs } = await supabase
      .from('sync_logs')
      .select('*, products!inner(clerk_user_id)', { count: 'exact', head: true })
      .eq('products.clerk_user_id', clerkUserId)
      .eq('status', LogStatus.SUCCESS)

    // Get failed syncs
    const { count: failedSyncs } = await supabase
      .from('sync_logs')
      .select('*, products!inner(clerk_user_id)', { count: 'exact', head: true })
      .eq('products.clerk_user_id', clerkUserId)
      .eq('status', LogStatus.ERROR)

    // Get last sync time
    const { data: lastSync } = await supabase
      .from('sync_logs')
      .select('created_at, products!inner(clerk_user_id)')
      .eq('products.clerk_user_id', clerkUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return {
      totalSyncs: totalSyncs || 0,
      successfulSyncs: successfulSyncs || 0,
      failedSyncs: failedSyncs || 0,
      lastSyncTime: lastSync?.created_at || null,
    }
  } catch (error) {
    console.warn('Database error, returning demo sync stats:', error)
    return {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastSyncTime: null,
    }
  }
}

/**
 * Get products that need syncing (pending or failed with retry count < 3)
 */
export async function getProductsNeedingSync(platform?: Platform): Promise<ChannelMapping[]> {
  const clerkUserId = getClerkUserId()

  if (!clerkUserId) {
    throw new Error('User not authenticated')
  }

  const supabase = await createClient()

  let query = supabase
    .from('channel_mappings')
    .select(`
      *,
      products!inner (
        id,
        title,
        clerk_user_id
      )
    `)
    .eq('products.clerk_user_id', clerkUserId)
    .or('sync_status.eq.pending,and(sync_status.eq.error,error_count.lt.3)')

  if (platform) {
    query = query.eq('platform', platform)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch products needing sync: ${error.message}`)
  }

  return data || []
}