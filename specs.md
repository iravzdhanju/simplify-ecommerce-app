# Product Sync Platform - Technical Specifications Document
## Updated: Clerk + Supabase Hybrid Architecture

## 1. Project Overview

### 1.1 Purpose
Develop an MVP Product Data Management (PDM) platform that enables brand owners to centrally manage product information and synchronize it across multiple e-commerce platforms, specifically Shopify and Amazon.

### 1.2 Core Value Proposition
- **Single Source of Truth**: Centralized product data management
- **Multi-Platform Sync**: Automated distribution to Shopify and Amazon
- **Real-time Status**: Live sync monitoring and error handling
- **Scalable Architecture**: Foundation for future platform integrations

## 2. System Architecture (Updated)

### 2.1 High-Level Architecture - Hybrid Approach
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Clerk Auth +   │    │  External APIs  │
│   (Next.js)     │◄──►│   Supabase DB    │◄──►│                 │
│                 │    │                  │    │ • Shopify API   │
│ • Clerk Auth    │    │ • PostgreSQL     │    │ • Amazon SP-API │
│ • Dashboard     │    │ • Edge Functions │    │ • Image Storage │
│ • Product CRUD  │    │ • User Sync      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 2.2 Technology Stack (Updated)

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15+ (App Router) | React framework with SSR/SSG |
| | Tailwind CSS | Utility-first CSS framework |
| | TypeScript | Type safety and developer experience |
| **Authentication** | Clerk | User management with OAuth support |
| **Backend** | Supabase | PostgreSQL database and Edge Functions |
| | Supabase Edge Functions | Serverless functions for sync operations |
| **Database** | PostgreSQL (via Supabase) | Primary data store |
| **File Storage** | Supabase Storage | Product image management |
| **User Sync** | Clerk Webhooks | Sync users from Clerk to Supabase |
| **Hosting** | Vercel | Frontend deployment and hosting |
| **External APIs** | Shopify Admin REST API | E-commerce platform integration |
| | Amazon SP-API | Marketplace integration |

## 3. Database Schema Design (Updated for Clerk Integration)

### 3.1 Core Tables

#### Users Table (Clerk Sync)
```sql
-- Users table to mirror Clerk users
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL, -- Clerk's user ID
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  image_url TEXT,
  clerk_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Clerk user lookups
CREATE INDEX idx_users_clerk_user_id ON users(clerk_user_id);
```

#### Products Table (Updated)
```sql
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clerk_user_id VARCHAR(255) NOT NULL, -- For quick lookup
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  inventory INTEGER DEFAULT 0,
  images TEXT[] DEFAULT '{}',
  sku VARCHAR(100) UNIQUE,
  brand VARCHAR(100),
  category VARCHAR(100),
  weight DECIMAL(8,2),
  dimensions JSONB, -- {length, width, height, unit}
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, draft
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_status ON products(status);
```

#### Channel Mappings Table
```sql
CREATE TABLE channel_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- 'shopify', 'amazon'
  external_id VARCHAR(255),
  external_variant_id VARCHAR(255), -- For Shopify variants
  sync_status VARCHAR(20) DEFAULT 'pending', -- pending, syncing, success, error
  last_synced TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  error_count INTEGER DEFAULT 0,
  sync_data JSONB, -- Platform-specific data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, platform)
);

-- Indexes
CREATE INDEX idx_channel_mappings_product_id ON channel_mappings(product_id);
CREATE INDEX idx_channel_mappings_platform ON channel_mappings(platform);
CREATE INDEX idx_channel_mappings_sync_status ON channel_mappings(sync_status);
```

#### Platform Connections Table
```sql
CREATE TABLE platform_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  connection_name VARCHAR(100),
  credentials JSONB NOT NULL, -- Encrypted credentials
  configuration JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_connected TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, platform, connection_name)
);

-- Indexes
CREATE INDEX idx_platform_connections_user_id ON platform_connections(user_id);
CREATE INDEX idx_platform_connections_platform ON platform_connections(platform);
```

#### Sync Logs Table
```sql
CREATE TABLE sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  operation VARCHAR(50) NOT NULL, -- create, update, delete
  status VARCHAR(20) NOT NULL, -- success, error, warning
  message TEXT,
  request_data JSONB,
  response_data JSONB,
  execution_time INTEGER, -- milliseconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sync_logs_product_id ON sync_logs(product_id);
CREATE INDEX idx_sync_logs_platform ON sync_logs(platform);
CREATE INDEX idx_sync_logs_created_at ON sync_logs(created_at);
```

### 3.2 Row Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Products policies
CREATE POLICY "Users can view own products" ON products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products" ON products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products" ON products
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products" ON products
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for other tables...
```

## 4. API Integration Specifications

### 4.1 Shopify Integration

#### 4.1.1 Authentication Flow
```javascript
// OAuth 2.0 Flow
const SHOPIFY_CONFIG = {
  client_id: process.env.SHOPIFY_CLIENT_ID,
  client_secret: process.env.SHOPIFY_CLIENT_SECRET,
  scopes: 'write_products,read_products,write_inventory,read_inventory',
  redirect_uri: `${process.env.NEXT_PUBLIC_URL}/api/auth/shopify/callback`
};

// Installation URL generation
function generateShopifyAuthUrl(shop) {
  const params = new URLSearchParams({
    client_id: SHOPIFY_CONFIG.client_id,
    scope: SHOPIFY_CONFIG.scopes,
    redirect_uri: SHOPIFY_CONFIG.redirect_uri,
    state: generateRandomState()
  });
  
  return `https://${shop}.myshopify.com/admin/oauth/authorize?${params}`;
}
```

#### 4.1.2 Product Sync Mapping
```javascript
// Product data transformation
function transformToShopifyProduct(product) {
  return {
    product: {
      title: product.title,
      body_html: product.description,
      vendor: product.brand,
      product_type: product.category,
      tags: product.tags.join(','),
      status: product.status === 'active' ? 'active' : 'draft',
      variants: [{
        price: product.price.toString(),
        inventory_quantity: product.inventory,
        sku: product.sku,
        weight: product.weight,
        weight_unit: 'kg'
      }],
      images: product.images.map(url => ({ src: url }))
    }
  };
}
```

#### 4.1.3 API Endpoints
- **Create Product**: `POST /admin/api/2023-10/products.json`
- **Update Product**: `PUT /admin/api/2023-10/products/{id}.json`
- **Get Product**: `GET /admin/api/2023-10/products/{id}.json`
- **Delete Product**: `DELETE /admin/api/2023-10/products/{id}.json`

### 4.2 Amazon SP-API Integration

#### 4.2.1 Authentication Setup
```javascript
// SP-API Configuration
const AMAZON_CONFIG = {
  region: 'us-east-1',
  marketplace_id: 'ATVPDKIKX0DER', // US marketplace
  role_arn: process.env.AMAZON_ROLE_ARN,
  client_id: process.env.AMAZON_CLIENT_ID,
  client_secret: process.env.AMAZON_CLIENT_SECRET,
  refresh_token: process.env.AMAZON_REFRESH_TOKEN
};

// LWA Token Exchange
async function getAccessToken() {
  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: AMAZON_CONFIG.refresh_token,
      client_id: AMAZON_CONFIG.client_id,
      client_secret: AMAZON_CONFIG.client_secret
    })
  });
  
  return response.json();
}
```

#### 4.2.2 Product Listing Transformation
```javascript
// Amazon listing data structure
function transformToAmazonListing(product) {
  return {
    productType: 'PRODUCT', // Or specific category
    requirements: {
      main_product_image_locator: {
        media_location: product.images[0]
      },
      product_title: {
        value: product.title
      },
      product_description: {
        value: product.description
      },
      brand: {
        value: product.brand
      },
      manufacturer: {
        value: product.brand
      },
      standard_price: {
        value: product.price,
        currency: 'USD'
      },
      quantity: product.inventory
    }
  };
}
```

#### 4.2.3 Key SP-API Endpoints
- **Submit Listing**: `PUT /listings/2021-08-01/items/{sellerId}/{sku}`
- **Get Listing**: `GET /listings/2021-08-01/items/{sellerId}/{sku}`
- **Delete Listing**: `DELETE /listings/2021-08-01/items/{sellerId}/{sku}`
- **Patch Listing**: `PATCH /listings/2021-08-01/items/{sellerId}/{sku}`

## 5. Supabase Edge Functions

### 5.1 Sync Function Architecture
```javascript
// Edge Function: sync-product
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { productId, platforms } = await req.json();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  );

  const results = [];
  
  for (const platform of platforms) {
    try {
      const result = await syncToPllatform(productId, platform, supabase);
      results.push(result);
    } catch (error) {
      await logSyncError(productId, platform, error, supabase);
      results.push({ platform, status: 'error', error: error.message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### 5.2 Scheduled Sync Function
```javascript
// Edge Function: scheduled-sync
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  // Cron job triggered sync
  const supabase = createClient(/* ... */);
  
  // Get products that need syncing
  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      channel_mappings(*)
    `)
    .eq('status', 'active')
    .lt('channel_mappings.last_synced', new Date(Date.now() - 24 * 60 * 60 * 1000));

  // Process sync queue
  const syncPromises = products.map(product => 
    syncProductToAllPlatforms(product)
  );

  await Promise.allSettled(syncPromises);
  
  return new Response('Sync completed');
});
```

## 6. Frontend Implementation Plan

### 6.1 Project Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── dashboard/
│   │   ├── products/
│   │   ├── sync/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/
│   │   ├── products/
│   │   └── sync/
│   └── layout.tsx
├── components/
│   ├── ui/ (shadcn components)
│   ├── forms/
│   ├── tables/
│   └── charts/
├── lib/
│   ├── supabase.ts
│   ├── shopify.ts
│   ├── amazon.ts
│   └── utils.ts
└── types/
    └── database.ts
```

### 6.2 Key Components

#### Product Form Component
```typescript
interface ProductFormProps {
  product?: Product;
  onSubmit: (data: ProductFormData) => Promise<void>;
  loading?: boolean;
}

export function ProductForm({ product, onSubmit, loading }: ProductFormProps) {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product || defaultProductValues
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Form fields */}
      </form>
    </Form>
  );
}
```

#### Sync Status Component
```typescript
interface SyncStatusProps {
  mappings: ChannelMapping[];
  onSync: (platform: string) => void;
}

export function SyncStatus({ mappings, onSync }: SyncStatusProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {mappings.map(mapping => (
        <SyncStatusCard
          key={mapping.platform}
          mapping={mapping}
          onSync={() => onSync(mapping.platform)}
        />
      ))}
    </div>
  );
}
```

### 6.3 State Management Strategy
- **Server State**: React Query/TanStack Query for API data
- **Form State**: React Hook Form with Zod validation
- **Global State**: Zustand for user preferences and UI state
- **Authentication**: Supabase Auth with context provider

## 7. Security Implementation

### 7.1 Authentication & Authorization
```typescript
// Middleware for API routes
export async function withAuth(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return session;
}

// RLS policies ensure data isolation
```

### 7.2 Credential Encryption
```typescript
// Encrypt sensitive platform credentials
import { encrypt, decrypt } from '@/lib/encryption';

async function storePlatformCredentials(userId: string, platform: string, credentials: any) {
  const encryptedCredentials = await encrypt(JSON.stringify(credentials));
  
  return supabase
    .from('platform_connections')
    .insert({
      user_id: userId,
      platform,
      credentials: encryptedCredentials
    });
}
```

## 8. Error Handling & Monitoring

### 8.1 Error Classification
```typescript
enum SyncErrorType {
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  PLATFORM_ERROR = 'platform_error'
}

interface SyncError {
  type: SyncErrorType;
  message: string;
  retryable: boolean;
  retryAfter?: number;
}
```

### 8.2 Retry Logic
```typescript
async function syncWithRetry(
  syncFn: () => Promise<any>,
  maxRetries: number = 3,
  backoffMs: number = 1000
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await syncFn();
    } catch (error) {
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      
      await new Promise(resolve => 
        setTimeout(resolve, backoffMs * Math.pow(2, attempt - 1))
      );
    }
  }
}
```

## 9. Testing Strategy

### 9.1 Testing Pyramid
- **Unit Tests**: Utility functions, data transformations
- **Integration Tests**: API routes, database operations
- **E2E Tests**: Critical user flows with Playwright
- **API Tests**: External API integrations with mocking

### 9.2 Test Configuration
```typescript
// Jest configuration
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};

// Mock Supabase for testing
jest.mock('@/lib/supabase', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));
```

## 10. Deployment & DevOps

### 10.1 Environment Configuration
```bash
# Environment Variables
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Shopify
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_WEBHOOK_SECRET=

# Amazon SP-API
AMAZON_CLIENT_ID=
AMAZON_CLIENT_SECRET=
AMAZON_ROLE_ARN=
AMAZON_REFRESH_TOKEN=

# Encryption
ENCRYPTION_KEY=
```

### 10.2 CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

## 11. Performance Optimization

### 11.1 Database Optimization
- Implement proper indexing on frequently queried columns
- Use database views for complex queries
- Optimize N+1 queries with proper joins
- Implement connection pooling

### 11.2 API Rate Limiting
```typescript
// Rate limiting for external APIs
class RateLimiter {
  private tokens: Map<string, number> = new Map();
  
  async acquire(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Implementation details...
    return true;
  }
}
```

## 12. Monitoring & Analytics

### 12.1 Key Metrics
- Sync success/failure rates per platform
- API response times
- User engagement metrics
- Error frequency and types
- Product sync volume

### 12.2 Logging Strategy
```typescript
// Structured logging
interface LogEvent {
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
  userId?: string;
  productId?: string;
}

function logSyncEvent(event: LogEvent) {
  console.log(JSON.stringify({
    ...event,
    timestamp: new Date().toISOString()
  }));
}
```

## 13. Implementation Timeline

### Week 1: Foundation Setup
- [ ] Next.js project initialization with TypeScript
- [ ] Supabase project setup and database schema
- [ ] Authentication system implementation
- [ ] Basic UI components and routing
- [ ] Development environment configuration

### Week 2: Core Product Management
- [ ] Product CRUD operations
- [ ] Image upload functionality
- [ ] Product form validation
- [ ] Basic product listing interface
- [ ] User dashboard layout

### Week 3: Shopify Integration
- [ ] Shopify OAuth implementation
- [ ] Product sync to Shopify
- [ ] Error handling and logging
- [ ] Sync status tracking
- [ ] Testing with sandbox environment

### Week 4: Amazon SP-API Integration
- [ ] Amazon SP-API authentication
- [ ] Product listing creation
- [ ] Inventory synchronization
- [ ] Error handling and retry logic
- [ ] Integration testing

### Week 5: Sync Dashboard & Status
- [ ] Comprehensive sync dashboard
- [ ] Real-time sync status updates
- [ ] Error log viewing
- [ ] Manual sync triggers
- [ ] Sync history tracking

### Week 6: Testing & Deployment
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Production deployment
- [ ] Documentation and handoff

## 14. Risk Assessment & Mitigation

### 14.1 Technical Risks
| Risk | Impact | Probability | Mitigation |
|------|---------|-------------|------------|
| API Rate Limits | High | Medium | Implement rate limiting and queuing |
| Platform API Changes | High | Low | Version pinning, monitoring |
| Data Loss | Critical | Low | Regular backups, RLS policies |
| Authentication Issues | High | Medium | Comprehensive error handling |

### 14.2 Business Risks
| Risk | Impact | Probability | Mitigation |
|------|---------|-------------|------------|
| Platform Policy Changes | High | Medium | Multi-platform strategy |
| User Adoption | High | Medium | User feedback integration |
| Competitor Response | Medium | High | Focus on unique value prop |

## 15. Post-MVP Roadmap

### Phase 2 Features
- Bulk import/export functionality
- Advanced inventory management
- Price optimization tools
- Analytics and reporting

### Phase 3 Features
- Additional marketplace integrations (Wayfair, Costco)
- AI-powered product descriptions
- Automated pricing strategies
- Team collaboration features

### Phase 4 Features
- API for third-party integrations
- White-label solutions
- Enterprise features
- Advanced automation workflows

---

## Appendices

### A. API Documentation Links
- [Shopify Admin API](https://shopify.dev/docs/api/admin-rest)
- [Amazon SP-API Documentation](https://developer.amazonservices.com/sp-api)
- [Supabase Documentation](https://supabase.com/docs)

### B. Sample API Responses
See separate documentation for detailed API response examples.

### C. Database Migration Scripts
See `/database/migrations/` directory for all SQL migration files.

---

## 16. Updated Development Plan - Clerk + Supabase Hybrid

### Phase 1: Foundation (Weeks 1-2)

#### Branch: `feature/supabase-setup`
**SMART Goals:**
- **Specific**: Set up Supabase with Clerk-compatible schema
- **Measurable**: Database schema created, user sync working
- **Achievable**: 3-4 days work
- **Relevant**: Foundation for all backend operations
- **Time-bound**: Week 1

**Tasks:**
- [ ] Set up Supabase project with modified user schema
- [ ] Create database schema optimized for Clerk user IDs
- [ ] Configure Supabase with Clerk webhook integration
- [ ] Set up Edge Functions infrastructure

**Testing:**
- Unit tests for database connection
- Integration tests for RLS policies
- Webhook payload validation tests

**Definition of Done:**
- [ ] Supabase project created with Clerk-compatible schema
- [ ] Webhook endpoint for Clerk user events
- [ ] User sync mechanism implemented
- [ ] RLS policies updated for Clerk user IDs
- [ ] Environment variables configured

#### Branch: `feature/clerk-supabase-sync`
**SMART Goals:**
- **Specific**: Complete user synchronization between Clerk and Supabase
- **Measurable**: All Clerk user events properly synced
- **Achievable**: 4-5 days work
- **Relevant**: Required for user-specific data isolation
- **Time-bound**: Week 2

**Tasks:**
- [ ] Create Clerk webhook handler for user events
- [ ] Implement user synchronization service
- [ ] Build user profile management
- [ ] Set up automatic user creation/updates

**Testing:**
- Webhook payload validation tests
- User sync integration tests
- Clerk event handling tests

**Definition of Done:**
- [ ] Clerk webhooks configured and working
- [ ] User sync on create/update/delete
- [ ] User profile data synchronized
- [ ] Error handling for sync failures
- [ ] Retry mechanism for failed syncs
- [ ] Sync status monitoring

### Phase 2: Core Product Management (Weeks 3-4)

#### Branch: `feature/product-crud-with-clerk`
**SMART Goals:**
- **Specific**: Full CRUD operations for products with Clerk auth
- **Measurable**: Create, read, update, delete products working
- **Achievable**: 5-6 days work
- **Relevant**: Core functionality of the platform
- **Time-bound**: Week 3

**Tasks:**
- [ ] Create product API routes using Clerk authentication
- [ ] Build product management with Clerk user context
- [ ] Implement Supabase RLS with Clerk user IDs
- [ ] Create product forms and listings

**Testing:**
- API route tests for all CRUD operations
- Form validation tests
- Image upload integration tests
- Data table functionality tests

**Definition of Done:**
- [ ] Product CRUD APIs with Clerk auth
- [ ] RLS policies using Clerk user IDs
- [ ] Product forms integrated with user context
- [ ] Image upload to Supabase Storage
- [ ] Product listing with proper user isolation

#### Branch: `feature/enhanced-clerk-integration`
**SMART Goals:**
- **Specific**: Enhanced user experience with onboarding
- **Measurable**: Complete user onboarding and profile management
- **Achievable**: 3-4 days work
- **Relevant**: Better user experience and retention
- **Time-bound**: Week 4

**Tasks:**
- [ ] Create user onboarding flow post-Clerk signup
- [ ] Build user profile management within app
- [ ] Implement user preferences and settings
- [ ] Add user-specific dashboard customization

**Definition of Done:**
- [ ] Post-signup onboarding flow
- [ ] User profile management interface
- [ ] User preferences stored in Supabase
- [ ] Dashboard personalization
- [ ] User settings synchronization

### Phase 3: Platform Integrations (Weeks 5-7)

#### Branch: `feature/shopify-integration-clerk`
**SMART Goals:**
- **Specific**: Complete Shopify integration with user context
- **Measurable**: Users can connect and sync with Shopify
- **Achievable**: 6-7 days work
- **Relevant**: Primary platform integration
- **Time-bound**: Weeks 5-6

**Tasks:**
- [ ] Implement Shopify OAuth with Clerk user context
- [ ] Store platform connections per Clerk user
- [ ] Build sync operations with user isolation
- [ ] Create platform management dashboard

**Definition of Done:**
- [ ] Shopify OAuth flow with Clerk integration
- [ ] User-specific platform connections
- [ ] Product sync to/from Shopify
- [ ] Error handling and retry logic
- [ ] Sync status monitoring

#### Branch: `feature/amazon-integration-clerk`
**SMART Goals:**
- **Specific**: Amazon SP-API integration with user context
- **Measurable**: Products successfully listed on Amazon
- **Achievable**: 6-7 days work
- **Relevant**: Second major platform integration
- **Time-bound**: Week 7

**Tasks:**
- [ ] Amazon SP-API integration with Clerk user context
- [ ] Multi-marketplace support per user
- [ ] Bulk operations with user-specific rate limiting
- [ ] Advanced error handling per user

**Definition of Done:**
- [ ] Amazon SP-API authentication per user
- [ ] Product listing creation and management
- [ ] User-specific rate limiting
- [ ] Comprehensive error handling
- [ ] Marketplace-specific validations

### Phase 4: Advanced Features (Weeks 8-10)

#### Branch: `feature/advanced-sync-dashboard`
**SMART Goals:**
- **Specific**: Comprehensive sync monitoring and control
- **Measurable**: Real-time sync status and controls working
- **Achievable**: 5-6 days work
- **Relevant**: Essential for platform management
- **Time-bound**: Weeks 8-9

**Tasks:**
- [ ] Real-time sync monitoring per user
- [ ] User-specific analytics and reporting
- [ ] Advanced bulk operations
- [ ] Custom sync schedules per user

**Definition of Done:**
- [ ] Real-time sync status updates
- [ ] User-specific analytics dashboard
- [ ] Bulk sync operations
- [ ] Custom scheduling interface
- [ ] Performance monitoring

#### Branch: `feature/testing-deployment`
**SMART Goals:**
- **Specific**: Production-ready deployment with monitoring
- **Measurable**: Application deployed with comprehensive testing
- **Achievable**: 4-5 days work
- **Relevant**: Production readiness
- **Time-bound**: Week 10

**Tasks:**
- [ ] Set up comprehensive testing suite
- [ ] Implement E2E tests with Playwright
- [ ] Configure production environment
- [ ] Set up monitoring and alerting

**Definition of Done:**
- [ ] 80%+ test coverage
- [ ] E2E tests for critical flows
- [ ] Production deployment successful
- [ ] Monitoring and alerting configured
- [ ] Documentation completed

### Updated Environment Configuration:

```bash
# Clerk (Keep existing)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/auth/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/auth/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard/overview"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/onboarding"

# Clerk Webhooks
CLERK_WEBHOOK_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Platform APIs
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
AMAZON_CLIENT_ID=
AMAZON_CLIENT_SECRET=
AMAZON_ROLE_ARN=
AMAZON_REFRESH_TOKEN=

# Security
ENCRYPTION_KEY=
```

### Key Benefits of Hybrid Approach:
1. **Faster Development**: Keep existing Clerk auth, focus on product features
2. **Better UX**: Users don't need to re-authenticate
3. **Scalable**: Supabase handles product data while Clerk manages users
4. **Flexible**: Can migrate away from Clerk later if needed
5. **Cost Effective**: Leverage Clerk's robust auth features initially

### Implementation Priority:
1. ✅ Keep Clerk authentication as-is
2. 🔄 Set up Supabase for product data
3. 🔄 Create user sync mechanism
4. 🔄 Build product management with user context
5. 🔄 Add platform integrations
6. 🔄 Enhance with advanced features

---

*This document serves as the primary technical specification for the Product Sync Platform MVP with Clerk + Supabase hybrid architecture. Updated with development plan and branch strategy.*