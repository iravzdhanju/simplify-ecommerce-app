# Shopify Integration Guide

This document provides comprehensive guidance for the Shopify integration built on top of our Supabase + Clerk infrastructure.

## Overview

The integration implements a modern, production-ready Shopify sync system using:
- **GraphQL Admin API 2025-01** (latest version)
- **Cost-based rate limiting** with intelligent backoff
- **OAuth 2.0 authentication** with secure token management
- **Real-time webhooks** for instant synchronization
- **Bulk operations** for efficient large-scale imports
- **Hybrid sync architecture** combining real-time and scheduled sync

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   Supabase DB    │    │   Shopify API   │
│                 │    │                  │    │                 │
│ • OAuth Flow    │◄──►│ • User Sync      │◄──►│ • GraphQL API   │
│ • Product CRUD  │    │ • Product Data   │    │ • Webhooks      │
│ • Sync Dashboard│    │ • Channel Maps   │    │ • Bulk Ops      │
│ • Bulk Import   │    │ • Sync Logs      │    │ • Rate Limits   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Key Features

### 🔐 Secure Authentication
- OAuth 2.0 with HMAC verification
- Encrypted credential storage
- Automatic token validation
- State parameter security

### ⚡ High Performance
- GraphQL cost-based rate limiting
- Intelligent query optimization
- Bulk operations for large datasets
- Efficient pagination and caching

### 🔄 Real-time Sync
- Webhook-driven updates
- Bidirectional synchronization
- Conflict resolution
- Error handling and retry logic

### 📊 Comprehensive Monitoring
- Detailed sync logs
- Performance metrics
- Error tracking
- Operational dashboards

## Setup Instructions

### 1. Environment Configuration

Add these variables to your `.env.local`:

```bash
# Shopify App Configuration
SHOPIFY_CLIENT_ID=your_shopify_app_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_app_client_secret
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# Application URL
NEXT_PUBLIC_URL=https://your-domain.com
```

### 2. Shopify App Setup

1. **Create Shopify Partner Account**
   - Go to [partners.shopify.com](https://partners.shopify.com)
   - Create a new partner account

2. **Create Public App**
   - In Partner Dashboard, create a new app
   - Choose "Public app" for distribution
   - Set app URL: `https://your-domain.com`
   - Set allowed redirection URLs: `https://your-domain.com/api/auth/shopify/callback`

3. **Configure App Scopes**
   ```
   read_products
   write_products
   read_inventory
   write_inventory
   read_orders
   read_customers
   ```

4. **Set Up Webhooks**
   - Webhook URL: `https://your-domain.com/api/webhooks/shopify`
   - Subscribe to events:
     - `products/create`
     - `products/update`
     - `products/delete`
     - `inventory_levels/update`

### 3. Database Setup

The database schema is already created in your Supabase instance. Verify these tables exist:
- `platform_connections` - Stores OAuth credentials
- `channel_mappings` - Maps products to external IDs
- `sync_logs` - Tracks all sync operations

## Usage Guide

### Connecting a Shopify Store

```typescript
// 1. Initiate OAuth flow
const response = await fetch('/api/auth/shopify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shop: 'store-name.myshopify.com',
    connectionName: 'My Store'
  })
});

const { authUrl, state } = await response.json();

// 2. Redirect user to Shopify for authorization
window.location.href = authUrl;

// 3. Handle callback (automatic)
// User will be redirected to /dashboard with connection status
```

### Syncing Products

#### Individual Product Sync
```typescript
// Sync a single product to Shopify
const response = await fetch('/api/sync/shopify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'uuid-of-product',
    operation: 'create', // 'create', 'update', 'delete'
    connectionId: 'optional-specific-connection'
  })
});

const result = await response.json();
```

#### Bulk Import from Shopify
```typescript
// Import all products from Shopify
const response = await fetch('/api/sync/shopify/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    syncType: 'full', // 'full' or 'incremental'
    connectionId: 'optional-specific-connection'
  })
});

const result = await response.json();
// Returns: { totalProducts, successfulImports, failedImports, errors }
```

#### Incremental Sync
```typescript
// Sync only recently updated products
const response = await fetch('/api/sync/shopify/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    syncType: 'incremental',
    since: '2024-01-01T00:00:00Z' // Optional, defaults to last 24 hours
  })
});
```

## API Reference

### Authentication Endpoints

#### `POST /api/auth/shopify`
Initiate Shopify OAuth flow.

**Request:**
```json
{
  "shop": "store-name.myshopify.com",
  "connectionName": "My Store"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://store-name.myshopify.com/admin/oauth/authorize?...",
    "state": "base64-encoded-state",
    "shop": "store-name.myshopify.com",
    "connectionName": "My Store"
  }
}
```

#### `GET /api/auth/shopify/callback`
Handle OAuth callback (automatic redirect).

### Sync Endpoints

#### `POST /api/sync/shopify`
Sync individual product to Shopify.

**Request:**
```json
{
  "productId": "uuid",
  "operation": "create|update|delete",
  "connectionId": "optional-uuid"
}
```

#### `POST /api/sync/shopify/bulk`
Perform bulk import from Shopify.

**Request:**
```json
{
  "syncType": "full|incremental",
  "connectionId": "optional-uuid",
  "since": "optional-iso-date"
}
```

#### `POST /api/webhooks/shopify`
Handle Shopify webhooks (automatic).

### Platform Connection Endpoints

#### `GET /api/platform-connections`
List all platform connections for user.

#### `POST /api/platform-connections`
Create new platform connection.

## Data Flow

### Product Creation Flow
1. User creates product in our app
2. Product stored in Supabase `products` table
3. User triggers sync to Shopify
4. GraphQL mutation creates product in Shopify
5. Shopify returns external product ID
6. Channel mapping created in `channel_mappings` table
7. Sync operation logged in `sync_logs` table

### Webhook Flow
1. Product updated in Shopify admin
2. Shopify sends webhook to our endpoint
3. Webhook signature verified
4. Product data transformed and updated in our database
5. Channel mapping status updated
6. Sync operation logged

### Bulk Import Flow
1. User initiates bulk import
2. Bulk GraphQL query submitted to Shopify
3. Shopify processes query asynchronously
4. Results downloaded and parsed (JSONL format)
5. Products processed in batches
6. Each product imported to our database
7. Channel mappings created for all products

## Error Handling

### Rate Limiting
- Automatic backoff on rate limit errors
- Cost-based token bucket algorithm
- Intelligent query cost estimation
- Retry logic with exponential backoff

### API Errors
```typescript
// Error types handled:
- ShopifyAuthError: Invalid credentials
- ShopifyThrottleError: Rate limit exceeded
- ShopifyCostError: Query too expensive
- ShopifyGraphQLError: API errors
```

### Webhook Errors
- Signature verification failures
- Duplicate webhook detection
- Processing error logging
- Automatic retry on transient failures

## Performance Optimization

### GraphQL Query Optimization
- Selective field querying
- Limited nested connections
- Cost estimation and monitoring
- Intelligent batching

### Caching Strategy
- Product data caching
- Rate limit state caching
- Connection credential caching
- Query result caching

### Bulk Operations
- JSONL streaming processing
- Batch insertion to database
- Memory-efficient parsing
- Progress tracking and reporting

## Monitoring and Observability

### Sync Logs
All operations logged with:
- Execution time
- Request/response data
- Error messages
- Success/failure status

### Metrics Tracked
- Sync success/failure rates
- API response times
- Rate limit utilization
- Error frequency by type

### Health Checks
- Connection validation
- Token freshness verification
- Webhook endpoint health
- Database connectivity

## Security Considerations

### Credential Protection
- Encrypted storage in Supabase
- Secure token transmission
- Access token validation
- Regular token refresh

### Webhook Security
- HMAC signature verification
- Timestamp validation
- Duplicate prevention
- Input sanitization

### API Security
- OAuth 2.0 implementation
- State parameter validation
- CSRF protection
- Request rate limiting

## Troubleshooting

### Common Issues

#### Authentication Failed
- Verify Shopify app credentials
- Check redirect URL configuration
- Validate OAuth scopes
- Review state parameter handling

#### Sync Failures
- Check API rate limits
- Verify product data format
- Review error logs
- Validate webhook configuration

#### Performance Issues
- Monitor GraphQL query costs
- Check bulk operation sizes
- Review caching configuration
- Analyze database performance

### Debug Tools

#### Sync Status Dashboard
```typescript
// Get sync status for products
const status = await fetch('/api/sync/status');
// Returns sync history, error rates, performance metrics
```

#### Connection Testing
```typescript
// Test platform connection
const test = await fetch(`/api/platform-connections/${id}/test`);
// Returns connection health and API access status
```

## Best Practices

### Development
1. Use sandbox/development stores for testing
2. Implement comprehensive error handling
3. Monitor rate limits during development
4. Test webhook handling thoroughly

### Production
1. Set up proper monitoring and alerting
2. Implement circuit breakers for external dependencies
3. Use bulk operations for large datasets
4. Schedule incremental syncs appropriately

### Scalability
1. Implement connection pooling
2. Use horizontal scaling for bulk operations
3. Cache frequently accessed data
4. Monitor and optimize database queries

## Migration from REST to GraphQL

This integration is built on GraphQL Admin API 2025-01, following Shopify's migration timeline:
- REST API marked legacy (October 2024)
- New apps must use GraphQL (April 2025)
- Enhanced features exclusive to GraphQL

Benefits of GraphQL implementation:
- 2x rate limits compared to REST
- Cost-based optimization
- Selective field querying
- Advanced bulk operations
- Future-proof architecture

## Support and Maintenance

### Regular Tasks
- Monitor sync success rates
- Review error logs
- Update API versions
- Test webhook endpoints
- Validate OAuth flows

### Updates
- Follow Shopify API versioning
- Update GraphQL queries as needed
- Maintain webhook compatibility
- Monitor deprecation notices

For additional support, refer to:
- [Shopify GraphQL Admin API](https://shopify.dev/docs/api/admin-graphql)
- [Shopify Partner Documentation](https://partners.shopify.com/docs)
- Project Supabase documentation in `/database/README.md`