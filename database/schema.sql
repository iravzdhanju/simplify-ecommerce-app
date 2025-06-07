-- Supabase Database Schema for Product Sync Platform
-- Updated for Clerk + Supabase Hybrid Architecture

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table to mirror Clerk users
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  image_url TEXT,
  clerk_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table with Clerk user reference
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clerk_user_id VARCHAR(255) NOT NULL,
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

-- Platform connections table for storing OAuth credentials
CREATE TABLE IF NOT EXISTS platform_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clerk_user_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL, -- 'shopify', 'amazon'
  connection_name VARCHAR(100),
  credentials JSONB NOT NULL, -- Encrypted credentials
  configuration JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_connected TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(clerk_user_id, platform, connection_name)
);

-- Channel mappings table for tracking sync status
CREATE TABLE IF NOT EXISTS channel_mappings (
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

-- Sync logs table for tracking all sync operations
CREATE TABLE IF NOT EXISTS sync_logs (
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

-- User preferences table for dashboard customization
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clerk_user_id VARCHAR(255) NOT NULL,
  preferences JSONB DEFAULT '{}',
  dashboard_layout JSONB DEFAULT '{}',
  notification_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(clerk_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_clerk_user_id ON products(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_platform_connections_user_id ON platform_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_clerk_user_id ON platform_connections(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON platform_connections(platform);
CREATE INDEX IF NOT EXISTS idx_channel_mappings_product_id ON channel_mappings(product_id);
CREATE INDEX IF NOT EXISTS idx_channel_mappings_platform ON channel_mappings(platform);
CREATE INDEX IF NOT EXISTS idx_channel_mappings_sync_status ON channel_mappings(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_product_id ON sync_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_platform ON sync_logs(platform);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_preferences_clerk_user_id ON user_preferences(clerk_user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies using Clerk user IDs
-- Users policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Products policies
CREATE POLICY "Users can view own products" ON products
  FOR SELECT USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert own products" ON products
  FOR INSERT WITH CHECK (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update own products" ON products
  FOR UPDATE USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete own products" ON products
  FOR DELETE USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Platform connections policies
CREATE POLICY "Users can view own connections" ON platform_connections
  FOR SELECT USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert own connections" ON platform_connections
  FOR INSERT WITH CHECK (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update own connections" ON platform_connections
  FOR UPDATE USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete own connections" ON platform_connections
  FOR DELETE USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Channel mappings policies (access through products)
CREATE POLICY "Users can view own channel mappings" ON channel_mappings
  FOR SELECT USING (
    product_id IN (
      SELECT id FROM products WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can insert own channel mappings" ON channel_mappings
  FOR INSERT WITH CHECK (
    product_id IN (
      SELECT id FROM products WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can update own channel mappings" ON channel_mappings
  FOR UPDATE USING (
    product_id IN (
      SELECT id FROM products WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can delete own channel mappings" ON channel_mappings
  FOR DELETE USING (
    product_id IN (
      SELECT id FROM products WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- Sync logs policies (access through products)
CREATE POLICY "Users can view own sync logs" ON sync_logs
  FOR SELECT USING (
    product_id IN (
      SELECT id FROM products WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can insert own sync logs" ON sync_logs
  FOR INSERT WITH CHECK (
    product_id IN (
      SELECT id FROM products WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- User preferences policies
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete own preferences" ON user_preferences
  FOR DELETE USING (clerk_user_id = auth.jwt() ->> 'sub');