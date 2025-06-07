# API Reference - Product Sync Platform

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Products API](#products-api)
- [Platform Connections API](#platform-connections-api)
- [Sync Operations API](#sync-operations-api)
- [Dashboard Metrics API](#dashboard-metrics-api)
- [Webhook Endpoints](#webhook-endpoints)
- [Types & Schemas](#types--schemas)

## Overview

The Product Sync Platform API provides comprehensive endpoints for managing e-commerce product synchronization across multiple platforms. All endpoints follow RESTful conventions and return JSON responses.

**Base URL:** `https://your-domain.com/api`

## Authentication

All API endpoints require authentication using Clerk JWT tokens.

### Headers Required
```
Authorization: Bearer <clerk_jwt_token>
Content-Type: application/json
```

### Authentication Flow
1. User authenticates with Clerk on frontend
2. Frontend receives JWT token
3. Include token in Authorization header for API requests
4. Backend validates token and extracts user context

## Error Handling

### Standard Error Response
```typescript
{
  success: false,
  error: string,
  details?: any
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Rate Limited
- `500` - Internal Server Error

### Common Error Scenarios
```typescript
// Validation Error
{
  success: false,
  error: "Validation error",
  details: [
    {
      field: "price",
      message: "Price must be a positive number"
    }
  ]
}

// Authentication Error
{
  success: false,
  error: "Unauthorized"
}

// Resource Not Found
{
  success: false,
  error: "Product not found"
}
```

## Rate Limiting

### Limits
- **Standard endpoints:** 100 requests per minute per user
- **Sync endpoints:** 10 requests per minute per user
- **Webhook endpoints:** 1000 requests per minute (global)

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1643723400
```

## Products API

### List Products
Get paginated list of user's products with optional filtering.

```
GET /api/products
```

#### Query Parameters
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| page | number | Page number | 1 |
| limit | number | Items per page (max 100) | 20 |
| search | string | Search in title, SKU, brand | - |
| category | string | Filter by category | - |
| status | string | Filter by status (active, inactive, draft) | - |
| sync_status | string | Filter by sync status | - |

#### Example Request
```bash
curl -X GET "https://your-domain.com/api/products?page=1&limit=20&status=active" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response
```typescript
{
  success: true,
  data: {
    products: Product[],
    pagination: {
      page: number,
      limit: number,
      total: number,
      hasMore: boolean
    }
  }
}
```

### Get Product
Retrieve a specific product by ID.

```
GET /api/products/[id]
```

#### Response
```typescript
{
  success: true,
  data: Product
}
```

### Create Product
Create a new product with optional sync to platforms.

```
POST /api/products
```

#### Request Body
```typescript
{
  title: string,
  description?: string,
  price?: number,
  inventory?: number,
  images?: string[],
  sku?: string,
  brand?: string,
  category?: string,
  weight?: number,
  dimensions?: {
    length: number,
    width: number,
    height: number,
    unit: string
  },
  tags?: string[],
  status?: 'active' | 'inactive' | 'draft',
  sync_to_platforms?: string[], // ['shopify', 'amazon']
  auto_sync?: boolean
}
```

#### Example Request
```bash
curl -X POST "https://your-domain.com/api/products" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Premium T-Shirt",
    "description": "High-quality cotton t-shirt",
    "price": 29.99,
    "inventory": 100,
    "category": "clothing",
    "status": "active",
    "sync_to_platforms": ["shopify"],
    "auto_sync": true
  }'
```

#### Response
```typescript
{
  success: true,
  data: Product,
  sync_results?: {
    shopify?: SyncResult,
    amazon?: SyncResult
  }
}
```

### Update Product
Update an existing product.

```
PUT /api/products/[id]
```

#### Request Body
Same as Create Product, all fields optional.

#### Response
```typescript
{
  success: true,
  data: Product,
  sync_results?: {
    shopify?: SyncResult,
    amazon?: SyncResult
  }
}
```

### Delete Product
Delete a product and optionally remove from platforms.

```
DELETE /api/products/[id]
```

#### Query Parameters
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| remove_from_platforms | boolean | Remove from connected platforms | false |

#### Response
```typescript
{
  success: true,
  message: "Product deleted successfully",
  platform_results?: {
    shopify?: SyncResult,
    amazon?: SyncResult
  }
}
```

## Platform Connections API

### List Connections
Get all platform connections for the authenticated user.

```
GET /api/platform-connections
```

#### Response
```typescript
{
  success: true,
  data: PlatformConnection[]
}
```

### Create Connection
Store platform connection credentials (used internally by OAuth flow).

```
POST /api/platform-connections
```

#### Request Body
```typescript
{
  platform: 'shopify' | 'amazon',
  connection_name: string,
  credentials: {
    // Platform-specific credentials
    access_token: string,
    shop_domain?: string, // Shopify
    seller_id?: string,   // Amazon
    // ... other platform fields
  },
  configuration?: {
    auto_sync: boolean,
    sync_inventory: boolean,
    sync_prices: boolean,
    sync_images: boolean
  }
}
```

#### Response
```typescript
{
  success: true,
  data: PlatformConnection
}
```

### Get Connection
Retrieve a specific platform connection.

```
GET /api/platform-connections/[id]
```

#### Response
```typescript
{
  success: true,
  data: PlatformConnection
}
```

### Test Connection
Test the health of a platform connection.

```
GET /api/platform-connections/[id]/test
```

#### Response
```typescript
{
  success: boolean,
  message: string,
  data?: {
    platform: string,
    shop_domain?: string,
    response_time?: number
  }
}
```

### Delete Connection
Remove a platform connection.

```
DELETE /api/platform-connections/[id]
```

#### Response
```typescript
{
  success: true,
  message: "Connection deleted successfully"
}
```

## Sync Operations API

### Manual Sync
Manually trigger sync for a specific product.

```
POST /api/sync/shopify
```

#### Request Body
```typescript
{
  product_id: string,
  operation: 'create' | 'update' | 'delete',
  connection_id?: string, // Optional, uses default connection if not specified
  force?: boolean // Force sync even if no changes detected
}
```

#### Response
```typescript
{
  success: boolean,
  data: {
    product_id: string,
    platform: string,
    operation: string,
    sync_status: string,
    external_id?: string,
    message?: string,
    execution_time: number
  }
}
```

### Bulk Sync Operations
Perform bulk sync operations.

```
POST /api/sync/shopify/bulk
```

#### Request Body
```typescript
{
  operation: 'import' | 'export' | 'sync_all',
  connection_id?: string,
  filters?: {
    category?: string,
    status?: string,
    updated_since?: string
  },
  options?: {
    include_images: boolean,
    include_variants: boolean,
    batch_size: number
  }
}
```

#### Response
```typescript
{
  success: true,
  data: {
    job_id: string,
    status: 'queued' | 'processing' | 'completed' | 'failed',
    total_items: number,
    processed_items: number,
    errors: string[],
    estimated_completion?: string
  }
}
```

### Get Sync Status
Check the status of a bulk sync operation.

```
GET /api/sync/shopify/bulk/[job_id]
```

#### Response
```typescript
{
  success: true,
  data: {
    job_id: string,
    status: string,
    progress: {
      total: number,
      completed: number,
      failed: number,
      percentage: number
    },
    results?: {
      created: number,
      updated: number,
      deleted: number,
      errors: Array<{
        item_id: string,
        error: string
      }>
    }
  }
}
```

## Dashboard Metrics API

### Get Dashboard Metrics
Retrieve real-time dashboard metrics.

```
GET /api/dashboard/metrics
```

#### Response
```typescript
{
  success: true,
  data: {
    products: {
      total: number,
      active: number,
      trend: string
    },
    connections: {
      total: number,
      active: number,
      trend: string
    },
    sync: {
      recentSyncs: number,
      recentErrors: number,
      successRate: number,
      successRateTrend: number
    },
    overview: {
      totalSyncAttempts: number,
      successfulSyncs: number,
      errorRate: number
    }
  }
}
```

### Get Sync Logs
Retrieve paginated sync operation logs.

```
GET /api/sync/logs
```

#### Query Parameters
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| page | number | Page number | 1 |
| limit | number | Items per page | 20 |
| platform | string | Filter by platform | - |
| status | string | Filter by status | - |
| product_id | string | Filter by product | - |
| date_from | string | Start date (ISO) | - |
| date_to | string | End date (ISO) | - |

#### Response
```typescript
{
  success: true,
  data: {
    logs: SyncLog[],
    pagination: PaginationInfo
  }
}
```

## Webhook Endpoints

### Shopify Webhooks
Handle incoming webhooks from Shopify.

```
POST /api/webhooks/shopify
```

#### Headers
```
X-Shopify-Topic: products/create|products/update|products/delete
X-Shopify-Hmac-Sha256: base64-encoded-signature
X-Shopify-Shop-Domain: shop-name.myshopify.com
```

#### Request Body
Shopify product payload (varies by webhook type)

#### Response
```typescript
{
  success: true,
  message: "Webhook processed successfully"
}
```

### Clerk Webhooks
Handle user lifecycle events from Clerk.

```
POST /api/webhooks/clerk
```

#### Headers
```
svix-id: unique-message-id
svix-timestamp: timestamp
svix-signature: signature
```

#### Supported Events
- `user.created` - Create user in Supabase
- `user.updated` - Update user information
- `user.deleted` - Soft delete user data

## Types & Schemas

### Product Type
```typescript
interface Product {
  id: string
  user_id: string
  clerk_user_id: string
  title: string
  description?: string
  price?: number
  inventory: number
  images: string[]
  sku?: string
  brand?: string
  category?: string
  weight?: number
  dimensions?: ProductDimensions
  tags: string[]
  status: 'active' | 'inactive' | 'draft'
  created_at: string
  updated_at: string
  sync_status?: {
    shopify?: SyncStatus
    amazon?: SyncStatus
    last_synced?: string
    error_message?: string
  }
}
```

### Platform Connection Type
```typescript
interface PlatformConnection {
  id: string
  user_id: string
  clerk_user_id: string
  platform: 'shopify' | 'amazon'
  connection_name?: string
  credentials: ShopifyCredentials | AmazonCredentials
  configuration: PlatformConfiguration
  is_active: boolean
  last_connected?: string
  created_at: string
  updated_at: string
}
```

### Sync Log Type
```typescript
interface SyncLog {
  id: string
  product_id: string
  platform: string
  operation: 'create' | 'update' | 'delete'
  status: 'success' | 'error' | 'warning'
  message?: string
  request_data?: any
  response_data?: any
  execution_time?: number
  created_at: string
}
```

### Shopify Credentials
```typescript
interface ShopifyCredentials {
  access_token: string
  shop_domain: string
  scope: string
  expires_at?: string
}
```

### Amazon Credentials
```typescript
interface AmazonCredentials {
  seller_id: string
  marketplace_id: string
  access_token: string
  refresh_token: string
  expires_at: string
}
```

### Sync Result
```typescript
interface SyncResult {
  success: boolean
  platform: string
  external_id?: string
  message?: string
  error?: string
  execution_time: number
}
```

### Pagination Info
```typescript
interface PaginationInfo {
  page: number
  limit: number
  total: number
  hasMore: boolean
}
```

## SDK Usage Examples

### JavaScript/TypeScript Client

```typescript
// Initialize client
const client = new ProductSyncAPI({
  baseURL: 'https://your-domain.com/api',
  getToken: () => clerk.session?.getToken()
})

// Create product
const product = await client.products.create({
  title: 'New Product',
  price: 29.99,
  sync_to_platforms: ['shopify']
})

// List products with filters
const products = await client.products.list({
  status: 'active',
  category: 'electronics',
  page: 1,
  limit: 20
})

// Test platform connection
const testResult = await client.connections.test('connection-id')

// Manual sync
const syncResult = await client.sync.manual({
  product_id: 'product-id',
  operation: 'update'
})
```

This API reference provides comprehensive documentation for all available endpoints in the Product Sync Platform. Each endpoint includes detailed request/response schemas, examples, and error handling information.