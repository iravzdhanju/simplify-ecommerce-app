# Implementation Guide - Product Sync Platform

## Table of Contents
- [Quick Start](#quick-start)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Authentication Setup](#authentication-setup)
- [Platform Integration Setup](#platform-integration-setup)
- [Frontend Development](#frontend-development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Supabase account
- Clerk account
- Shopify Partner account (for app development)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd simplify-ecommerce-app

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Start development server
pnpm dev
```

## Environment Setup

### 1. Create Required Accounts

**Supabase:**
1. Visit [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

**Clerk:**
1. Visit [clerk.com](https://clerk.com)
2. Create a new application
3. Note your publishable and secret keys

**Shopify Partners:**
1. Visit [partners.shopify.com](https://partners.shopify.com)
2. Create a partner account
3. Create a new app for development

### 2. Environment Configuration

Create `.env.local` with the following variables:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Shopify Configuration
SHOPIFY_CLIENT_ID=your-shopify-client-id
SHOPIFY_CLIENT_SECRET=your-shopify-client-secret
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key
```

## Database Setup

### 1. Create Supabase Schema

Run the following SQL in your Supabase SQL editor:

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  image_url TEXT,
  clerk_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  inventory INTEGER DEFAULT 0,
  images TEXT[] DEFAULT '{}',
  sku TEXT,
  brand TEXT,
  category TEXT,
  weight DECIMAL(8,2),
  dimensions JSONB,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('active', 'inactive', 'draft')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create platform_connections table
CREATE TABLE platform_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('shopify', 'amazon')),
  connection_name TEXT,
  credentials JSONB NOT NULL,
  configuration JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_connected TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create channel_mappings table
CREATE TABLE channel_mappings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT,
  external_variant_id TEXT,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
  last_synced TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  error_count INTEGER DEFAULT 0,
  sync_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sync_logs table
CREATE TABLE sync_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning')),
  message TEXT,
  request_data JSONB,
  response_data JSONB,
  execution_time INTEGER, -- milliseconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_preferences table
CREATE TABLE user_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  preferences JSONB DEFAULT '{}',
  dashboard_layout JSONB DEFAULT '{}',
  notification_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX idx_products_clerk_user_id ON products(clerk_user_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_platform_connections_clerk_user_id ON platform_connections(clerk_user_id);
CREATE INDEX idx_platform_connections_platform ON platform_connections(platform);
CREATE INDEX idx_channel_mappings_product_id ON channel_mappings(product_id);
CREATE INDEX idx_channel_mappings_platform ON channel_mappings(platform);
CREATE INDEX idx_sync_logs_product_id ON sync_logs(product_id);
CREATE INDEX idx_sync_logs_created_at ON sync_logs(created_at);
```

### 2. Set Up Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only access their own data
CREATE POLICY "Users can access own data" ON users
FOR ALL USING (clerk_user_id = current_setting('app.current_user_id'));

CREATE POLICY "Users can access own products" ON products
FOR ALL USING (clerk_user_id = current_setting('app.current_user_id'));

CREATE POLICY "Users can access own connections" ON platform_connections
FOR ALL USING (clerk_user_id = current_setting('app.current_user_id'));

-- Channel mappings through product ownership
CREATE POLICY "Users can access own channel mappings" ON channel_mappings
FOR ALL USING (
  product_id IN (
    SELECT id FROM products 
    WHERE clerk_user_id = current_setting('app.current_user_id')
  )
);

-- Sync logs through product ownership
CREATE POLICY "Users can access own sync logs" ON sync_logs
FOR ALL USING (
  product_id IN (
    SELECT id FROM products 
    WHERE clerk_user_id = current_setting('app.current_user_id')
  )
);

CREATE POLICY "Users can access own preferences" ON user_preferences
FOR ALL USING (clerk_user_id = current_setting('app.current_user_id'));
```

### 3. Create Database Functions

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_connections_updated_at BEFORE UPDATE ON platform_connections
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channel_mappings_updated_at BEFORE UPDATE ON channel_mappings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Authentication Setup

### 1. Configure Clerk

In your Clerk dashboard:

1. **Set up authentication methods:**
   - Email/Password
   - Google OAuth (optional)
   - GitHub OAuth (optional)

2. **Configure webhooks:**
   - Endpoint: `https://your-domain.com/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`

3. **Set up JWT template:**
   - Template name: `supabase`
   - Claims:
     ```json
     {
       "aud": "authenticated",
       "exp": "{{user.exp}}",
       "iat": "{{user.iat}}",
       "iss": "{{user.iss}}",
       "sub": "{{user.id}}",
       "email": "{{user.primary_email_address.email_address}}",
       "app_metadata": {
         "provider": "clerk",
         "providers": ["clerk"]
       },
       "user_metadata": {
         "clerk_user_id": "{{user.id}}"
       }
     }
     ```

### 2. Supabase JWT Configuration

In your Supabase dashboard:

1. Go to **Settings > API**
2. Update JWT Settings with Clerk's JWT template
3. Add Clerk's public key for JWT verification

## Platform Integration Setup

### 1. Shopify App Configuration

In your Shopify Partners dashboard:

1. **Create a new app:**
   - App type: Custom app
   - App URL: `https://your-domain.com`
   - Allowed redirection URL: `https://your-domain.com/api/auth/shopify/callback`

2. **Configure app scopes:**
   ```
   read_products,write_products,
   read_product_listings,write_product_listings,
   read_inventory,write_inventory,
   read_orders,read_customers
   ```

3. **Set up webhooks:**
   - Product creation: `https://your-domain.com/api/webhooks/shopify`
   - Product updates: `https://your-domain.com/api/webhooks/shopify`
   - Product deletion: `https://your-domain.com/api/webhooks/shopify`

### 2. Webhook Verification

Create a webhook secret in Shopify and add it to your environment variables:
```bash
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret-here
```

## Frontend Development

### 1. Component Structure

The frontend follows a modular component architecture:

```
src/
├── app/                 # Next.js App Router
├── components/          # Shared UI components
├── features/           # Feature-specific components
│   ├── auth/
│   ├── products/
│   ├── connections/
│   └── overview/
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
└── types/              # TypeScript definitions
```

### 2. Development Workflow

```bash
# Start development server
pnpm dev

# Run type checking
pnpm type-check

# Run linting
pnpm lint

# Run tests
pnpm test

# Build for production
pnpm build
```

### 3. Adding New Features

1. **Create feature directory:**
   ```bash
   mkdir src/features/new-feature
   mkdir src/features/new-feature/components
   mkdir src/features/new-feature/hooks
   ```

2. **Add API routes:**
   ```bash
   mkdir src/app/api/new-feature
   touch src/app/api/new-feature/route.ts
   ```

3. **Create database types:**
   ```typescript
   // Add to src/types/database.ts
   export interface NewFeature {
     id: string
     // ... other fields
   }
   ```

## Testing

### 1. Unit Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### 2. API Testing

Test API routes using tools like:
- Postman
- Insomnia
- curl commands

Example API test:
```bash
# Test product creation
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{"title":"Test Product","price":29.99}'
```

### 3. Integration Testing

Test the complete flow:
1. User authentication
2. Platform connection
3. Product creation
4. Sync operation
5. Data verification

## Deployment

### 1. Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
# ... add all other environment variables
```

### 2. Database Migration

```bash
# Apply migrations to production
supabase db push --project-ref YOUR_PROJECT_REF
```

### 3. DNS Configuration

1. **Custom domain setup in Vercel**
2. **Update Clerk allowed origins**
3. **Update Shopify app URLs**

### 4. Production Environment Variables

Ensure all production environment variables are set:
- Use production Clerk keys
- Use production Supabase project
- Use production Shopify app credentials
- Set secure NEXTAUTH_SECRET

## Troubleshooting

### Common Issues

#### 1. Authentication Issues

**Problem:** User can't sign in
**Solution:**
- Check Clerk configuration
- Verify environment variables
- Check network requests in browser dev tools

#### 2. Database Connection Issues

**Problem:** RLS policy errors
**Solution:**
- Verify RLS policies are correctly set
- Check user context is being set
- Review Supabase logs

#### 3. Shopify Integration Issues

**Problem:** OAuth flow fails
**Solution:**
- Verify Shopify app configuration
- Check redirect URLs
- Validate client ID and secret

#### 4. Sync Issues

**Problem:** Products not syncing
**Solution:**
- Check webhook configuration
- Verify API scopes
- Review sync logs in database

### Debug Commands

```bash
# Check database connection
pnpm db:status

# View Supabase logs
supabase logs

# Test API endpoints
curl -X GET http://localhost:3000/api/health

# Check environment variables
pnpm env:check
```

### Monitoring

Set up monitoring for:
- API response times
- Error rates
- Sync success rates
- Database performance

Use tools like:
- Vercel Analytics
- Supabase Dashboard
- Clerk Dashboard
- Custom logging

## Performance Optimization

### 1. Frontend Optimization

- Use React.memo() for expensive components
- Implement proper loading states
- Use TanStack Query for data fetching
- Optimize images with Next.js Image component

### 2. Backend Optimization

- Implement database indexing
- Use connection pooling
- Cache frequently accessed data
- Optimize Supabase queries

### 3. API Optimization

- Implement rate limiting
- Use pagination for large datasets
- Compress API responses
- Implement proper error handling

This implementation guide provides a complete roadmap for setting up and deploying the Product Sync Platform. Follow each section carefully and refer to the Architecture documentation for deeper technical details.