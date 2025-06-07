# Database Setup Instructions

This directory contains the database schema and setup instructions for the Product Sync Platform using Supabase with Clerk authentication.

## Prerequisites

1. Create a Supabase account at [https://supabase.com](https://supabase.com)
2. Create a new Supabase project
3. Have your Clerk application set up and running

## Database Setup

### 1. Run the Schema

Execute the `schema.sql` file in your Supabase SQL editor:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `schema.sql`
4. Click "Run" to execute the schema

This will create:
- All necessary tables (users, products, platform_connections, channel_mappings, sync_logs, user_preferences)
- Indexes for performance optimization
- Row Level Security (RLS) policies
- Proper foreign key relationships

### 2. Configure Environment Variables

Copy the environment variables from Supabase:

1. Go to Settings > API in your Supabase dashboard
2. Copy the Project URL and anon/public key
3. Copy the service_role key (keep this secret!)
4. Update your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Set Up Clerk Webhooks

Configure Clerk to sync users to Supabase:

1. Go to your Clerk dashboard
2. Navigate to Webhooks
3. Create a new webhook endpoint: `https://your-domain.com/api/webhooks/clerk`
4. Subscribe to these events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Copy the webhook secret and add it to your environment:

```bash
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret
```

## Database Structure

### Core Tables

#### `users`
Mirrors Clerk users in Supabase for data relationships
- `clerk_user_id`: Reference to Clerk user
- `email`, `first_name`, `last_name`: User profile data
- `clerk_metadata`: Full Clerk user object for reference

#### `products`
Main product catalog
- References `users` table via `user_id` and `clerk_user_id`
- Contains all product information (title, description, price, etc.)
- Supports images array, tags, and custom dimensions

#### `platform_connections`
Stores encrypted OAuth credentials for external platforms
- `platform`: 'shopify' or 'amazon'
- `credentials`: Encrypted platform credentials (access tokens, etc.)
- `configuration`: Platform-specific sync settings

#### `channel_mappings`
Tracks sync status between products and external platforms
- Links products to their external platform IDs
- Tracks sync status (pending, syncing, success, error)
- Stores error messages and retry counts

#### `sync_logs`
Detailed logs of all sync operations
- Operation type (create, update, delete)
- Request/response data for debugging
- Execution times for performance monitoring
- Success/error status with detailed messages

#### `user_preferences`
User-specific settings and dashboard customization
- Theme preferences
- Notification settings
- Dashboard layout configuration

## Security Features

### Row Level Security (RLS)
All tables have RLS enabled with policies that:
- Use Clerk user ID from JWT token for authorization
- Ensure users can only access their own data
- Provide proper isolation between users

### Data Encryption
- Platform credentials are encrypted before storage
- Sensitive data is protected at rest
- JWT tokens used for authentication

## API Integration

### Available Endpoints

#### Products
- `GET /api/products` - List user's products
- `POST /api/products` - Create new product
- `GET /api/products/[id]` - Get specific product
- `PUT /api/products/[id]` - Update product
- `DELETE /api/products/[id]` - Delete product

#### Platform Connections
- `GET /api/platform-connections` - List user's connections
- `POST /api/platform-connections` - Create new connection

#### Sync Operations
- `POST /api/sync/shopify` - Sync product to Shopify
- More platforms to be added

### Helper Functions

The following utility functions are available for Agent A to use:

#### Product Operations
```typescript
import { 
  getUserProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct 
} from '@/lib/supabase/products'
```

#### Sync Operations
```typescript
import { 
  upsertChannelMapping, 
  updateSyncStatus, 
  logSyncOperation 
} from '@/lib/supabase/sync'
```

#### Platform Connections
```typescript
import { 
  getActiveShopifyConnections,
  createPlatformConnection 
} from '@/lib/supabase/platform-connections'
```

## Development Workflow

1. **User Authentication**: Clerk handles user auth, webhook syncs to Supabase
2. **Product Management**: Full CRUD operations with proper user isolation
3. **Platform Integration**: Agent A can use the sync utilities to integrate with Shopify
4. **Error Handling**: Comprehensive logging and retry mechanisms
5. **Monitoring**: Sync status tracking and performance metrics

## Testing

Before integrating with external platforms:

1. Test user sync by creating/updating users in Clerk
2. Verify products can be created/updated via API
3. Test platform connection creation
4. Verify RLS policies work correctly

## Next Steps for Agent A

1. Use the `/api/sync/shopify` endpoint as a foundation
2. Replace the placeholder `syncProductToShopify` function with actual Shopify API calls
3. Use the existing error handling and logging infrastructure
4. Test with the provided database utilities
5. Extend the sync operations for additional Shopify features

The database and API foundation is ready for Shopify integration!