import { NextRequest, NextResponse } from 'next/server'
import { getUserProduct, updateProduct, deleteProduct } from '@/lib/supabase/products'
import { requireAuth } from '@/lib/supabase/auth'
import { z } from 'zod'

const updateProductSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive').optional(),
  inventory: z.number().int().min(0, 'Inventory cannot be negative').optional(),
  images: z.array(z.string().url()).optional(),
  sku: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(['in', 'cm', 'ft', 'm']),
  }).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'draft']).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAuth()

    const product = await getUserProduct((await params).id)

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: product,
    })
  } catch (error) {
    console.error(`GET /api/products/${(await params).id} error:`, error)

    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAuth()

    const body = await req.json()
    const validatedData = updateProductSchema.parse(body)

    const product = await updateProduct((await params).id, validatedData)

    return NextResponse.json({
      success: true,
      data: product,
    })
  } catch (error) {
    console.error(`PUT /api/products/${(await params).id} error:`, error)

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
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAuth()

    await deleteProduct((await params).id)

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    })
  } catch (error) {
    console.error(`DELETE /api/products/${(await params).id} error:`, error)

    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}