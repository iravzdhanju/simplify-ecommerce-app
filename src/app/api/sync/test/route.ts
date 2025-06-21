import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { shopifySyncManager } from '@/lib/shopify/sync-manager'

/**
 * GET /api/sync/test
 * Test Shopify connections and sync functionality
 */
export async function GET(req: NextRequest) {
  try {
    requireAuth()
    
    await shopifySyncManager.initialize()
    
    // Test connection
    const connectionTest = await shopifySyncManager.testConnection()
    
    // Get sync stats
    const stats = await shopifySyncManager.getSyncStats()
    
    // Get sync health
    const health = await shopifySyncManager.getSyncHealth()
    
    return NextResponse.json({
      success: true,
      data: {
        connection: connectionTest,
        stats,
        health,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('GET /api/sync/test error:', error)
    
    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}