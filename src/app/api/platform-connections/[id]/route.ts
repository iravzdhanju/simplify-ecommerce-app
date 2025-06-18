import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import {
  deletePlatformConnection,
  testPlatformConnection,
  getPlatformConnectionById
} from '@/lib/supabase/platform-connections'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAuth()
    const { id } = await params
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Connection ID is required' },
        { status: 400 }
      )
    }

    await deletePlatformConnection(id)

    return NextResponse.json({
      success: true,
      message: 'Connection deleted successfully'
    })
  } catch (error) {
    console.error('DELETE /api/platform-connections/[id] error:', error)

    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete connection' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAuth()

    const { id } = await params
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Connection ID is required' },
        { status: 400 }
      )
    }

    const connection = await getPlatformConnectionById(id)

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: connection
    })
  } catch (error) {
    console.error('GET /api/platform-connections/[id] error:', error)

    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch connection' },
      { status: 500 }
    )
  }
}