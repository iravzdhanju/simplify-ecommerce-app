import { NextRequest, NextResponse } from 'next/server'
import { getUserProducts, createProduct } from '@/lib/supabase/products'
import { requireAuth } from '@/lib/supabase/auth'
import { z } from 'zod'

const createProductSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive').optional(),
  inventory: z.number().int().min(0, 'Inventory cannot be negative').default(0),
  images: z.array(z.string().url()).default([]),
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
  tags: z.array(z.string()).default([]),
  status: z.enum(['active', 'inactive', 'draft']).default('active'),
})

export async function GET() {
  try {
    requireAuth()
    
    const products = await getUserProducts()
    
    return NextResponse.json({
      success: true,
      data: products,
    })
  } catch (error) {
    console.error('GET /api/products error:', error)
    
    if (error instanceof Error && error.message === 'Unauthorized: User must be authenticated') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAuth()
    
    const body = await req.json()
    const validatedData = createProductSchema.parse(body)
    
    const product = await createProduct(validatedData)
    
    return NextResponse.json({
      success: true,
      data: product,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/products error:', error)
    
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
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    )
  }
}