import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { shopifySyncManager } from '@/lib/shopify/sync-manager'
import { SyncOperation } from '@/types/database'
import { z } from 'zod'

const batchSyncSchema = z.object({
  productIds: z.array(z.string().uuid('Invalid product ID')).min(1).max(50),
  operation: z.enum(['create', 'update', 'delete']).default('update'),
  connectionId: z.string().uuid('Invalid connection ID').optional(),
  batchSize: z.number().min(1).max(10).default(5)
})

/**
 * POST /api/sync/batch
 * Sync multiple products to Shopify in batches
 */
export async function POST(req: NextRequest) {
  try {
    requireAuth()
    
    const body = await req.json()
    const { productIds, operation, connectionId, batchSize } = batchSyncSchema.parse(body)
    
    await shopifySyncManager.initialize()
    
    const result = await shopifySyncManager.syncMultipleProductsToShopify(
      productIds,
      operation as SyncOperation,
      connectionId,
      batchSize
    )

    return NextResponse.json({
      success: result.success,
      data: {
        operation,
        totalProcessed: result.totalProcessed,
        successful: result.successful,
        failed: result.failed,
        errors: result.errors,
        processingTime: result.processingTime,
        successRate: result.totalProcessed > 0 
          ? Math.round((result.successful / result.totalProcessed) * 100) 
          : 0
      }
    })
    
  } catch (error) {
    console.error('POST /api/sync/batch error:', error)
    
    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation error',
          details: error.errors 
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to perform batch sync' },
      { status: 500 }
    )
  }
}