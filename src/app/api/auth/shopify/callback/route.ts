import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getClerkUserId, getAuthenticatedUserId } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import { Platform } from '@/types/database'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const shop = searchParams.get('shop')
    const error = searchParams.get('error')

    if (error) {
      console.error('Shopify OAuth error:', error)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/connections?error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state || !shop) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/connections?error=missing_parameters`
      )
    }

    // Verify state matches expected format (clerkUserId-timestamp).  Because the clerkUserId itself may contain hyphens, we need to split from the right-hand side.
    const lastDash = state.lastIndexOf('-')
    const clerkUserIdFromState = state.substring(0, lastDash)

    const currentUserId = await requireAuth()

    if (clerkUserIdFromState !== currentUserId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/connections?error=invalid_state`
      )
    }

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Failed to exchange code for token:', await tokenResponse.text())
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/connections?error=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()
    const { access_token, scope } = tokenData

    // Test the connection by making a simple API call
    const testResponse = await fetch(`https://${shop}/admin/api/2023-10/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': access_token,
        'Content-Type': 'application/json',
      },
    })

    if (!testResponse.ok) {
      console.error('Failed to test Shopify connection:', await testResponse.text())
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/connections?error=connection_test_failed`
      )
    }

    const shopData = await testResponse.json()

    // -------------------------------------------------------------------
    // Persist the connection in Supabase so it shows up in the dashboard
    // -------------------------------------------------------------------
    try {
      const clerkUserId = await getClerkUserId()

      if (!clerkUserId) {
        console.error('No authenticated user found for Shopify connection')
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/connections?error=auth_required`
        )
      }

      // For demo mode, use the createPlatformConnection function which handles the demo user properly
      const { createPlatformConnection } = await import('@/lib/supabase/platform-connections')

      // Fallback connection name: Shopify store name or the shop domain prefix
      const fallbackConnectionName =
        shopData?.shop?.name ?? shop.replace('.myshopify.com', '')

      await createPlatformConnection(
        Platform.SHOPIFY,
        fallbackConnectionName,
        {
          access_token,
          shop_domain: shop,
          scope
        },
        {
          auto_sync: true,
          sync_inventory: true,
          sync_prices: true,
          sync_images: true
        }
      )

      console.log('Successfully saved Shopify connection for shop:', shop)
    } catch (dbError) {
      console.error('Failed to save Shopify connection:', dbError)
      // If it's a duplicate key error, that means the connection already exists
      if (dbError instanceof Error && dbError.message.includes('duplicate key')) {
        console.log('Shopify connection already exists for this store')
      }
      // Don't fail the entire flow, just log the error
    }

    // Trigger automatic product import in the background
    try {
      // Start background import without blocking the redirect
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync/shopify/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.get('Cookie') || '', // Pass authentication cookies
        },
      }).catch(error => {
        console.error('Background import failed:', error)
      })
    } catch (error) {
      console.error('Failed to trigger background import:', error)
    }

    // Redirect back to connections page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/connections?success=shopify_connected&shop=${encodeURIComponent(shop)}&auto_import=started`
    )

  } catch (error) {
    console.error('Shopify OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/connections?error=callback_error`
    )
  }
}