import { NextRequest, NextResponse } from 'next/server'
import { createShopifyOAuth } from '@/lib/shopify/oauth'
import { requireAuth } from '@/lib/supabase/auth'

/**
 * GET /api/auth/shopify/callback
 * Handle Shopify OAuth callback
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    
    const shop = searchParams.get('shop')
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const hmac = searchParams.get('hmac')
    const timestamp = searchParams.get('timestamp')
    
    // Basic validation
    if (!shop || !code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard?error=invalid_callback', req.url)
      )
    }
    
    // Get stored state from query params or session
    // In production, this should be retrieved from a secure store
    const storedState = searchParams.get('stored_state') || state
    const connectionName = searchParams.get('connection_name') || `${shop} Store`
    
    try {
      const shopifyOAuth = createShopifyOAuth()
      
      // Handle the OAuth callback
      const credentials = await shopifyOAuth.handleCallback(
        shop,
        code,
        state,
        storedState,
        hmac || undefined,
        timestamp || undefined
      )
      
      // Store the connection
      const connection = await shopifyOAuth.storeConnection(
        credentials,
        connectionName,
        {
          auto_sync: false,
          sync_inventory: true,
          sync_prices: true,
          sync_images: true,
        }
      )
      
      // Redirect to success page
      return NextResponse.redirect(
        new URL(`/dashboard?success=shopify_connected&connection=${connection.id}`, req.url)
      )
    } catch (oauthError) {
      console.error('OAuth callback error:', oauthError)
      
      return NextResponse.redirect(
        new URL(`/dashboard?error=oauth_failed&message=${encodeURIComponent(oauthError.message)}`, req.url)
      )
    }
  } catch (error) {
    console.error('GET /api/auth/shopify/callback error:', error)
    
    return NextResponse.redirect(
      new URL('/dashboard?error=callback_failed', req.url)
    )
  }
}