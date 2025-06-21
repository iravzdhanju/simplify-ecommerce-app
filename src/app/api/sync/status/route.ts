import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { shopifySyncManager } from '@/lib/shopify/sync-manager'

/**
 * GET /api/sync/status
 * Get comprehensive sync status and statistics
 */
export async function GET(req: NextRequest) {
  try {
    requireAuth()
    
    await shopifySyncManager.initialize()
    
    // Check if user has any Shopify connections
    const hasConnections = shopifySyncManager['connections'].length > 0
    
    if (!hasConnections) {
      return NextResponse.json({
        success: true,
        data: {
          stats: {
            totalProducts: 0,
            syncedProducts: 0,
            pendingProducts: 0,
            errorProducts: 0,
            lastSyncTime: null
          },
          health: {
            status: 'warning',
            message: 'No Shopify connections found. Please connect a store first.',
            details: { hasConnections: false }
          },
          recentActivity: [],
          lastUpdated: new Date().toISOString()
        }
      })
    }
    
    const [stats, health, recentActivity] = await Promise.all([
      shopifySyncManager.getSyncStats(),
      shopifySyncManager.getSyncHealth(),
      shopifySyncManager.getRecentSyncActivity(20)
    ])

    return NextResponse.json({
      success: true,
      data: {
        stats,
        health,
        recentActivity: recentActivity.slice(0, 10), // Latest 10 activities
        lastUpdated: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('GET /api/sync/status error:', error)
    
    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}