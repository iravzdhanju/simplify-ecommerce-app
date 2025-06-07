import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'

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

    // Verify state matches expected format (clerkUserId-timestamp)
    const [clerkUserId] = state.split('-')
    const currentUserId = requireAuth()
    
    if (clerkUserId !== currentUserId) {
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

    // For MVP demo - log the successful connection instead of saving to database
    console.log('Shopify connection successful:', {
      shop,
      shopName: shopData.shop?.name,
      scope,
      access_token: access_token.substring(0, 10) + '...' // Only log partial token for security
    })

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