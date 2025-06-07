import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import { getClerkUserId } from '@/lib/supabase/auth'

export async function GET() {
  try {
    requireAuth()
    
    const userId = getClerkUserId()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createClient()
    
    // Get total products count
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('clerk_user_id', userId)

    // Get active products count
    const { count: activeProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('clerk_user_id', userId)
      .eq('status', 'active')

    // Get total platform connections
    const { count: totalConnections } = await supabase
      .from('platform_connections')
      .select('*', { count: 'exact', head: true })
      .eq('clerk_user_id', userId)

    // Get active connections
    const { count: activeConnections } = await supabase
      .from('platform_connections')
      .select('*', { count: 'exact', head: true })
      .eq('clerk_user_id', userId)
      .eq('is_active', true)

    // Get successful syncs in last 24h
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const { count: recentSyncs } = await supabase
      .from('sync_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'success')
      .gte('created_at', yesterday.toISOString())

    // Get recent sync errors
    const { count: recentErrors } = await supabase
      .from('sync_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('created_at', yesterday.toISOString())

    // Get sync success rate (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: syncStats } = await supabase
      .from('sync_logs')
      .select('status')
      .gte('created_at', thirtyDaysAgo.toISOString())

    const totalSyncAttempts = syncStats?.length || 0
    const successfulSyncs = syncStats?.filter(s => s.status === 'success').length || 0
    const syncSuccessRate = totalSyncAttempts > 0 ? (successfulSyncs / totalSyncAttempts) * 100 : 0

    // Calculate trends (compare with previous period)
    const twoMonthsAgo = new Date()
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60)
    
    const { data: previousStats } = await supabase
      .from('sync_logs')
      .select('status')
      .gte('created_at', twoMonthsAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString())

    const previousTotalSyncs = previousStats?.length || 0
    const previousSuccessfulSyncs = previousStats?.filter(s => s.status === 'success').length || 0
    const previousSuccessRate = previousTotalSyncs > 0 ? (previousSuccessfulSyncs / previousTotalSyncs) * 100 : 0

    const successRateTrend = syncSuccessRate - previousSuccessRate

    return NextResponse.json({
      success: true,
      data: {
        products: {
          total: totalProducts || 0,
          active: activeProducts || 0,
          trend: '+2.1' // Could be calculated from historical data
        },
        connections: {
          total: totalConnections || 0,
          active: activeConnections || 0,
          trend: totalConnections > 0 ? '+100' : '0'
        },
        sync: {
          recentSyncs: recentSyncs || 0,
          recentErrors: recentErrors || 0,
          successRate: Math.round(syncSuccessRate * 10) / 10,
          successRateTrend: Math.round(successRateTrend * 10) / 10
        },
        overview: {
          totalSyncAttempts,
          successfulSyncs,
          errorRate: totalSyncAttempts > 0 ? Math.round(((totalSyncAttempts - successfulSyncs) / totalSyncAttempts) * 100 * 10) / 10 : 0
        }
      }
    })
  } catch (error) {
    console.error('Dashboard metrics API error:', error)
    
    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    )
  }
}