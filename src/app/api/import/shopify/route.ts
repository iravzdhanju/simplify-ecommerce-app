import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { importService } from '@/lib/services/import-service'

/**
 * Start a Shopify import operation
 */
export async function POST() {
    try {
        await requireAuth()

        const result = await importService.startShopifyImport()

        if (result.success) {
            return NextResponse.json({
                success: true,
                importId: result.importId,
                message: 'Import started successfully'
            })
        } else {
            return NextResponse.json({
                success: false,
                error: result.error
            }, { status: 400 })
        }

    } catch (error) {
        console.error('Import start error:', error)

        if (error instanceof Error && (
            error.message === 'Authentication required' ||
            error.message === 'Unauthorized: User must be authenticated' ||
            error.message === 'User not authenticated'
        )) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to start import'
            },
            { status: 500 }
        )
    }
}

/**
 * Get import status
 */
export async function GET() {
    try {
        await requireAuth()

        const status = await importService.getImportStatus()

        return NextResponse.json({
            success: true,
            data: status
        })

    } catch (error) {
        console.error('Import status error:', error)

        if (error instanceof Error && (
            error.message === 'Authentication required' ||
            error.message === 'Unauthorized: User must be authenticated'
        )) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get import status'
            },
            { status: 500 }
        )
    }
} 