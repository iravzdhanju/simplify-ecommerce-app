import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { testPlatformConnection } from '@/lib/supabase/platform-connections'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    requireAuth()
    
    const { id } = params
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Connection ID is required' },
        { status: 400 }
      )
    }

    const testResult = await testPlatformConnection(id)
    
    return NextResponse.json({
      success: testResult.success,
      message: testResult.message,
      data: testResult.data
    })
  } catch (error) {
    console.error('GET /api/platform-connections/[id]/test error:', error)
    
    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to test connection',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}