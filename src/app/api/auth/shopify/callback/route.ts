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

    const currentUserId = requireAuth()

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
      const supabase = await createClient()

      const clerkUserId = getClerkUserId()
      const userId = await getAuthenticatedUserId()

      // Fallback connection name: Shopify store name or the shop domain prefix
      const fallbackConnectionName =
        shopData?.shop?.name ?? shop.replace('.myshopify.com', '')

      const { error: insertError } = await supabase.from('platform_connections').insert({
        user_id: userId,
        clerk_user_id: clerkUserId,
        platform: Platform.SHOPIFY,
        connection_name: fallbackConnectionName,
        credentials: {
          access_token,
          shop_domain: shop,
          scope
        },
        configuration: {},
        last_connected: new Date().toISOString()
      })

      if (insertError) {
        console.error('Failed to save Shopify connection:', insertError)
      }
    } catch (dbError) {
      console.error('Unexpected error while saving Shopify connection:', dbError)
    }

    // Redirect back to connections page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/connections?success=shopify_connected&shop=${encodeURIComponent(shop)}`
    )

  } catch (error) {
    console.error('Shopify OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/connections?error=callback_error`
    )
  }
}