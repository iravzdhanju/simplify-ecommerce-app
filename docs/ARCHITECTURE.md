# Product Sync Platform - Architecture & Implementation Documentation

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Data Flow](#data-flow)
- [Backend Implementation](#backend-implementation)
- [Frontend Implementation](#frontend-implementation)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Deployment](#deployment)
- [Future Enhancements](#future-enhancements)

## Overview

The Product Sync Platform is a comprehensive e-commerce integration solution that enables seamless product synchronization between multiple platforms (Shopify, Amazon) and a centralized dashboard. The system uses a hybrid Clerk + Supabase architecture for authentication and data management.

### Key Features
- **Multi-platform Integration**: Connect to Shopify and Amazon (extensible)
- **Real-time Synchronization**: Webhooks + bulk operations
- **Centralized Dashboard**: Unified product management interface
- **Sync Status Tracking**: Complete audit trail and error handling
- **OAuth Authentication**: Secure platform connections
- **Real-time Metrics**: Live dashboard with sync performance data

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Shopify API   │    │   Amazon SP-API │    │   Future APIs   │
│                 │    │                 │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ OAuth + Webhooks     │ OAuth + Webhooks     │ OAuth + Webhooks
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Services                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Shopify Sync   │  │  Amazon Sync    │  │  Platform Mgmt  │ │
│  │   Service       │  │   Service       │  │    Service      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                              │                                 │
│                              ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Supabase Database                          │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │   │
│  │  │ Products│ │Platform │ │ Channel │ │  Sync   │      │   │
│  │  │         │ │Connect. │ │Mappings │ │  Logs   │      │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Dashboard     │  │   Products      │  │  Connections    │ │
│  │   Overview      │  │  Management     │  │  Management     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                              │                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Sync Logs     │  │   Bulk Import   │  │   User Profile  │ │
│  │   & Monitoring  │  │   Interface     │  │   & Settings    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Authentication Layer                             │
│           Clerk (Frontend) + Supabase (Backend)                │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- Next.js 15 (App Router)
- TypeScript
- TailwindCSS + shadcn/ui
- TanStack Table
- React Hook Form + Zod
- Clerk Authentication

**Backend:**
- Supabase (PostgreSQL + Edge Functions)
- Next.js API Routes
- Row Level Security (RLS)
- Real-time subscriptions

**External Integrations:**
- Shopify GraphQL Admin API 2025-01
- Amazon SP-API (planned)
- OAuth 2.0 flows

## Data Flow

### 1. Authentication Flow
```
User → Clerk Auth → Frontend → Backend (Clerk User ID) → Supabase RLS
```

### 2. Platform Connection Flow
```
User → Connection UI → OAuth Initiation → Platform → Callback → Store Credentials → Supabase
```

### 3. Product Sync Flow
```
Platform Webhook → Sync Service → Transform Data → Supabase → Frontend Updates
```

### 4. Frontend Data Flow
```
Frontend → API Routes → Supabase → Transform → UI Components
```

## Backend Implementation

### Core Services

#### 1. Authentication Service (`src/lib/supabase/auth.ts`)
```typescript
// Hybrid Clerk + Supabase authentication
- getClerkUserId(): Get authenticated Clerk user ID
- requireAuth(): Ensure user is authenticated
- getAuthenticatedUserId(): Get Supabase user ID from Clerk user
```

#### 2. Platform Connections Service (`src/lib/supabase/platform-connections.ts`)
```typescript
// Platform connection management
- createPlatformConnection(): Store OAuth credentials
- testPlatformConnection(): Validate connection health
- getUserPlatformConnections(): Get user's connections
- deletePlatformConnection(): Remove connection
```

#### 3. Shopify Sync Service (`src/lib/shopify/`)
```typescript
// Shopify integration
- client.ts: GraphQL client with rate limiting
- product-sync.ts: Bidirectional sync operations
- auth.ts: OAuth flow handling
```

#### 4. Product API Service (`src/lib/api/products.ts`)
```typescript
// Frontend-facing product API
- getProducts(): Fetch products with sync status
- createProduct(): Create and optionally sync
- syncToShopify(): Manual sync operations
```

### API Routes

#### Authentication Routes
- `POST /api/auth/shopify` - Initiate Shopify OAuth
- `GET /api/auth/shopify/callback` - Handle OAuth callback

#### Platform Management Routes
- `GET /api/platform-connections` - List user connections
- `POST /api/platform-connections` - Create connection
- `DELETE /api/platform-connections/[id]` - Remove connection
- `GET /api/platform-connections/[id]/test` - Test connection

#### Product Management Routes
- `GET /api/products` - List products with filters
- `POST /api/products` - Create product
- `PUT /api/products/[id]` - Update product
- `DELETE /api/products/[id]` - Delete product

#### Sync Operations Routes
- `POST /api/sync/shopify` - Manual sync operations
- `POST /api/sync/shopify/bulk` - Bulk import/export
- `GET /api/dashboard/metrics` - Real-time metrics

#### Webhook Routes
- `POST /api/webhooks/shopify` - Shopify webhook handler
- `POST /api/webhooks/clerk` - Clerk user sync

## Frontend Implementation

### Component Architecture

#### 1. Layout Components (`src/components/layout/`)
- `app-sidebar.tsx`: Navigation sidebar
- `header.tsx`: Top navigation
- `providers.tsx`: Context providers

#### 2. Feature Components

**Products (`src/features/products/`):**
- `product-form.tsx`: Enhanced form with sync capabilities
- `product-tables/`: Enhanced tables with sync status
- `product-listing.tsx`: Main product list view

**Connections (`src/features/connections/`):**
- `connections-page.tsx`: Platform connection management
- `shopify-connection-card.tsx`: Shopify-specific connection UI

**Overview (`src/features/overview/`):**
- `overview.tsx`: Real-time dashboard metrics
- Chart components with live data

#### 3. Custom Hooks (`src/hooks/`)
- `use-dashboard-metrics.tsx`: Real-time metrics fetching
- `use-data-table.ts`: Enhanced table functionality

### State Management

The application uses a hybrid approach:
- **Server State**: TanStack Query for API data
- **Client State**: React state for UI interactions
- **Form State**: React Hook Form for complex forms
- **Real-time State**: Supabase subscriptions (planned)

## Database Schema

### Core Tables

#### users
```sql
- id: uuid (primary key)
- clerk_user_id: text (unique, indexed)
- email: text
- first_name: text
- last_name: text
- image_url: text
- clerk_metadata: jsonb
- created_at: timestamp
- updated_at: timestamp
```

#### products
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key to users)
- clerk_user_id: text (indexed for RLS)
- title: text
- description: text
- price: decimal
- inventory: integer
- images: text[]
- sku: text
- brand: text
- category: text
- weight: decimal
- dimensions: jsonb
- tags: text[]
- status: text (active, inactive, draft)
- created_at: timestamp
- updated_at: timestamp
```

#### platform_connections
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key to users)
- clerk_user_id: text (indexed for RLS)
- platform: text (shopify, amazon)
- connection_name: text
- credentials: jsonb (encrypted)
- configuration: jsonb
- is_active: boolean
- last_connected: timestamp
- created_at: timestamp
- updated_at: timestamp
```

#### channel_mappings
```sql
- id: uuid (primary key)
- product_id: uuid (foreign key to products)
- platform: text
- external_id: text
- external_variant_id: text
- sync_status: text (pending, syncing, success, error)
- last_synced: timestamp
- error_message: text
- error_count: integer
- sync_data: jsonb
- created_at: timestamp
- updated_at: timestamp
```

#### sync_logs
```sql
- id: uuid (primary key)
- product_id: uuid (foreign key to products)
- platform: text
- operation: text (create, update, delete)
- status: text (success, error, warning)
- message: text
- request_data: jsonb
- response_data: jsonb
- execution_time: integer (milliseconds)
- created_at: timestamp
```

### Row Level Security (RLS) Policies

All tables implement RLS using Clerk user IDs:

```sql
-- Example policy for products table
CREATE POLICY "Users can only access their own products" ON products
FOR ALL USING (clerk_user_id = current_setting('app.current_user_id'));
```

## API Documentation

### Authentication

All API routes require Clerk authentication. The user's Clerk ID is extracted and used for authorization.

### Rate Limiting

- Shopify API: Cost-based rate limiting (2000 points/second)
- Internal APIs: Request-based limiting (100 req/min per user)

### Error Handling

Standardized error responses:
```typescript
{
  success: boolean
  error?: string
  details?: any
  data?: any
}
```

### Pagination

List endpoints support cursor-based pagination:
```typescript
{
  data: T[]
  pagination: {
    cursor: string
    hasMore: boolean
    total: number
  }
}
```

## Security

### Authentication & Authorization
- **Frontend**: Clerk handles user authentication
- **Backend**: Clerk user ID validation + Supabase RLS
- **Database**: Row-level security ensures data isolation

### Credential Management
- **Storage**: Encrypted credentials in Supabase
- **Access**: Credentials never exposed to frontend
- **Rotation**: Support for token refresh (OAuth)

### Data Protection
- **Transit**: HTTPS/TLS encryption
- **Rest**: Database encryption at rest
- **Validation**: Zod schema validation on all inputs

### CORS & CSP
- Configured for production security
- API routes restricted to authenticated requests
- Content Security Policy headers

## Deployment

### Environment Variables
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Shopify
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_WEBHOOK_SECRET=

# Application
NEXT_PUBLIC_APP_URL=
NEXTAUTH_SECRET=
```

### Vercel Deployment

The application is optimized for Vercel deployment:
- Next.js App Router
- Edge Functions for webhooks
- Automatic scaling
- CDN optimization

### Database Migrations

Supabase migrations are managed via SQL files:
```bash
supabase migration new <migration_name>
supabase db push
```

## Future Enhancements

### Phase 2: Amazon Integration
- Amazon SP-API integration
- Multi-marketplace support
- FBA/FBM inventory management

### Phase 3: Advanced Features
- **Bulk Operations**: CSV import/export
- **Automation Rules**: Conditional sync logic
- **Analytics**: Advanced reporting dashboard
- **Notifications**: Email/SMS alerts for sync issues

### Phase 4: Enterprise Features
- **Multi-tenant Support**: Team collaboration
- **API Access**: Public API for integrations
- **White-label**: Customizable branding
- **Advanced Security**: SSO, audit logs

### Technical Improvements
- **Real-time Sync**: WebSocket connections
- **Offline Support**: Progressive Web App
- **Performance**: React Server Components
- **Testing**: E2E test coverage
- **Monitoring**: Application performance monitoring

## Development Workflow

### Local Setup
```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local

# Start development server
pnpm dev

# Run database migrations
pnpm db:push
```

### Testing Strategy
- **Unit Tests**: Jest + React Testing Library
- **Integration Tests**: API route testing
- **E2E Tests**: Playwright (planned)
- **Manual Testing**: Staging environment

### Code Quality
- **TypeScript**: Strict mode enabled
- **ESLint**: Custom rules for consistency
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks

This architecture provides a solid foundation for a scalable, secure, and maintainable product sync platform that can grow with business needs while maintaining excellent developer and user experience.