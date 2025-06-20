import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import { getClerkUserId } from '@/lib/supabase/auth'

/**
 * Get bulk import status - check recent sync operations
 */
export async function GET() {
    try {
        await requireAuth()
        const clerkUserId = await getClerkUserId()

        if (!clerkUserId) {
            return NextResponse.json(
                { success: false, error: 'User not authenticated' },
                { status: 401 }
            )
        }

        const supabase = await createClient()

        // Get recent sync logs to determine import status
        const { data: syncLogs, error: logsError } = await supabase
            .from('sync_logs')
            .select('*')
            .eq('platform', 'shopify')
            .eq('operation', 'bulk_import')
            .order('created_at', { ascending: false })
            .limit(10)

        // Get total products count
        const { count: totalProducts, error: countError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('clerk_user_id', clerkUserId)

        // Get products with Shopify channel mappings
        const { data: channelMappings, error: mappingsError } = await supabase
            .from('channel_mappings')
            .select('product_id, sync_status, error_message')
            .eq('platform', 'shopify')

        if (countError || mappingsError) {
            console.error('Error fetching import status:', countError || mappingsError)
        }

        const imported = channelMappings?.filter(m => m.sync_status === 'success')?.length || 0
        const errors = channelMappings?.filter(m => m.sync_status === 'error')?.length || 0
        const errorMessages = channelMappings
            ?.filter(m => m.sync_status === 'error' && m.error_message)
            ?.map(m => m.error_message)
            ?.slice(0, 5) || []

        // Determine if import is currently active
        const recentLog = syncLogs?.[0]
        const isActiveImport = recentLog &&
            recentLog.status === 'pending' &&
            (Date.now() - new Date(recentLog.created_at).getTime()) < (5 * 60 * 1000) // Within 5 minutes

        return NextResponse.json({
            success: true,
            data: {
                isActive: isActiveImport,
                totalProducts: totalProducts || 0,
                imported,
                errors: errorMessages.length,
                errorMessages,
                lastSync: recentLog?.created_at || null,
                status: recentLog?.status || 'idle'
            }
        })

    } catch (error) {
        console.error('Import status check error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to check import status'
            },
            { status: 500 }
        )
    }
} 