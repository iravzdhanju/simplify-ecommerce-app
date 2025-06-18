import crypto from 'crypto'
import { createPlatformConnection } from '@/lib/supabase/platform-connections'
import { Platform, ShopifyCredentials, ShopifyConfiguration } from '@/types/database'

interface ShopifyOAuthConfig {
  clientId: string
  clientSecret: string
  scopes: string[]
  redirectUri: string
}

interface OAuthState {
  nonce: string
  userId: string
  timestamp: number
}

/**
 * Shopify OAuth 2.0 Implementation
 * Handles secure shop authentication and token exchange
 */
export class ShopifyOAuth {
  private config: ShopifyOAuthConfig

  constructor(config: ShopifyOAuthConfig) {
    this.config = config
  }

  /**
   * Generate authorization URL for shop installation
   */
  generateAuthUrl(shop: string, userId: string): { url: string; state: string } {
    // Validate shop domain
    if (!this.isValidShopDomain(shop)) {
      throw new Error('Invalid shop domain')
    }

    // Generate secure state parameter
    const state = this.generateState(userId)

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: this.config.scopes.join(','),
      redirect_uri: this.config.redirectUri,
      state,
      response_type: 'code',
    })

    const authUrl = `https://${shop}/admin/oauth/authorize?${params.toString()}`

    return { url: authUrl, state }
  }

  /**
   * Handle OAuth callback and exchange code for access token
   */
  async handleCallback(
    shop: string,
    code: string,
    state: string,
    storedState: string,
    hmac?: string,
    timestamp?: string
  ): Promise<ShopifyCredentials> {
    // Validate callback parameters
    this.validateCallback(shop, code, state, storedState, hmac, timestamp)

    // Exchange authorization code for access token
    const credentials = await this.exchangeCodeForToken(shop, code)

    // Verify the access token by making a test API call
    await this.verifyAccessToken(shop, credentials.access_token)

    return credentials
  }

  /**
   * Store Shopify connection in Supabase
   */
  async storeConnection(
    credentials: ShopifyCredentials,
    connectionName: string,
    configuration: Partial<ShopifyConfiguration> = {}
  ) {
    const defaultConfig: ShopifyConfiguration = {
      auto_sync: false,
      sync_inventory: true,
      sync_prices: true,
      sync_images: true,
      ...configuration,
    }

    return createPlatformConnection(
      Platform.SHOPIFY,
      connectionName,
      credentials,
      defaultConfig
    )
  }

  /**
   * Exchange authorization code for access token
   */

  private async exchangeCodeForToken(shop: string, code: string): Promise<ShopifyCredentials> {
    const tokenEndpoint = `https://${shop}/admin/oauth/access_token`

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
    }

    const tokenData = await response.json()

    return {
      access_token: tokenData.access_token,
      shop_domain: shop,
      scope: tokenData.scope,
      expires_at: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : undefined,
    }
  }

  /**
   * Verify access token by making a test API call
   */
  private async verifyAccessToken(shop: string, accessToken: string): Promise<void> {
    const testEndpoint = `https://${shop}/admin/api/2025-01/shop.json`

    const response = await fetch(testEndpoint, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Access token verification failed: ${response.status}`)
    }

    const shopData = await response.json()

    if (!shopData.shop) {
      throw new Error('Invalid response from Shopify API')
    }
  }

  /**
   * Validate OAuth callback parameters
   */
  private validateCallback(
    shop: string,
    code: string,
    state: string,
    storedState: string,
    hmac?: string,
    timestamp?: string
  ): void {
    // Validate shop domain
    if (!this.isValidShopDomain(shop)) {
      throw new Error('Invalid shop domain')
    }

    // Validate state parameter
    if (state !== storedState) {
      throw new Error('Invalid state parameter')
    }

    // Validate state structure and expiry
    this.validateState(state)

    // Validate authorization code
    if (!code || code.length < 10) {
      throw new Error('Invalid authorization code')
    }

    // Validate HMAC if provided (webhook-style validation)
    if (hmac && timestamp) {
      this.validateHMAC(shop, code, state, timestamp, hmac)
    }
  }

  /**
   * Validate HMAC signature for additional security
   */
  private validateHMAC(
    shop: string,
    code: string,
    state: string,
    timestamp: string,
    receivedHmac: string
  ): void {
    // Check timestamp freshness (within 5 minutes)
    const timestampNum = parseInt(timestamp, 10)
    const now = Math.floor(Date.now() / 1000)

    if (Math.abs(now - timestampNum) > 300) {
      throw new Error('Request timestamp too old')
    }

    // Calculate expected HMAC
    const queryString = `code=${code}&shop=${shop}&state=${state}&timestamp=${timestamp}`
    const expectedHmac = crypto
      .createHmac('sha256', this.config.clientSecret)
      .update(queryString)
      .digest('hex')

    // Timing-safe comparison
    if (!crypto.timingSafeEqual(
      Buffer.from(receivedHmac, 'hex'),
      Buffer.from(expectedHmac, 'hex')
    )) {
      throw new Error('Invalid HMAC signature')
    }
  }

  /**
   * Generate secure state parameter
   */
  private generateState(userId: string): string {
    const nonce = crypto.randomBytes(16).toString('hex')
    const timestamp = Date.now()

    const stateData: OAuthState = {
      nonce,
      userId,
      timestamp,
    }

    // Base64 encode the state data
    return Buffer.from(JSON.stringify(stateData)).toString('base64')
  }

  /**
   * Validate state parameter structure and expiry
   */
  private validateState(state: string): OAuthState {
    try {
      const stateData: OAuthState = JSON.parse(
        Buffer.from(state, 'base64').toString('utf8')
      )

      // Check required fields
      if (!stateData.nonce || !stateData.userId || !stateData.timestamp) {
        throw new Error('Invalid state structure')
      }

      // Check state expiry (30 minutes)
      const now = Date.now()
      const stateAge = now - stateData.timestamp

      if (stateAge > 30 * 60 * 1000) {
        throw new Error('State parameter expired')
      }

      return stateData
    } catch (error) {
      throw new Error('Invalid state parameter format')
    }
  }

  /**
   * Validate shop domain format
   */
  private isValidShopDomain(shop: string): boolean {
    const shopPattern = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/
    return shopPattern.test(shop)
  }

  /**
   * Refresh access token (if supported by shop)
   */
  async refreshAccessToken(credentials: ShopifyCredentials): Promise<ShopifyCredentials> {
    // Note: Shopify access tokens typically don't expire
    // This method is here for completeness and future-proofing

    // For now, just verify the token is still valid
    await this.verifyAccessToken(credentials.shop_domain, credentials.access_token)

    return {
      ...credentials,
      expires_at: undefined, // Shopify tokens don't typically expire
    }
  }

  /**
   * Revoke access token
   */
  async revokeAccessToken(credentials: ShopifyCredentials): Promise<void> {
    // Shopify doesn't have a standard token revocation endpoint
    // Tokens are revoked when the app is uninstalled from the shop

    // We can test if the token is still valid
    try {
      await this.verifyAccessToken(credentials.shop_domain, credentials.access_token)
      throw new Error('Token is still valid - uninstall app from Shopify admin to revoke')
    } catch (error) {
      // If verification fails, token is likely already revoked
      console.log('Token appears to be revoked')
    }
  }
}

/**
 * Create Shopify OAuth instance with environment configuration
 */
export function createShopifyOAuth(): ShopifyOAuth {
  const config: ShopifyOAuthConfig = {
    clientId: process.env.SHOPIFY_CLIENT_ID!,
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET!,
    scopes: [
      'read_products',
      'write_products',
      'read_inventory',
      'write_inventory',
      'read_orders',
      'read_customers',
    ],
    redirectUri: `${process.env.NEXT_PUBLIC_URL}/api/auth/shopify/callback`,
  }

  if (!config.clientId || !config.clientSecret) {
    throw new Error('Shopify OAuth configuration is incomplete')
  }

  return new ShopifyOAuth(config)
}