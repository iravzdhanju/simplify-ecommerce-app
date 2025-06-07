export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          clerk_user_id: string
          email: string
          first_name: string | null
          last_name: string | null
          image_url: string | null
          clerk_metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          image_url?: string | null
          clerk_metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          image_url?: string | null
          clerk_metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          user_id: string
          clerk_user_id: string
          title: string
          description: string | null
          price: number | null
          inventory: number
          images: string[]
          sku: string | null
          brand: string | null
          category: string | null
          weight: number | null
          dimensions: Json | null
          tags: string[]
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          clerk_user_id: string
          title: string
          description?: string | null
          price?: number | null
          inventory?: number
          images?: string[]
          sku?: string | null
          brand?: string | null
          category?: string | null
          weight?: number | null
          dimensions?: Json | null
          tags?: string[]
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          clerk_user_id?: string
          title?: string
          description?: string | null
          price?: number | null
          inventory?: number
          images?: string[]
          sku?: string | null
          brand?: string | null
          category?: string | null
          weight?: number | null
          dimensions?: Json | null
          tags?: string[]
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      platform_connections: {
        Row: {
          id: string
          user_id: string
          clerk_user_id: string
          platform: string
          connection_name: string | null
          credentials: Json
          configuration: Json
          is_active: boolean
          last_connected: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          clerk_user_id: string
          platform: string
          connection_name?: string | null
          credentials: Json
          configuration?: Json
          is_active?: boolean
          last_connected?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          clerk_user_id?: string
          platform?: string
          connection_name?: string | null
          credentials?: Json
          configuration?: Json
          is_active?: boolean
          last_connected?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      channel_mappings: {
        Row: {
          id: string
          product_id: string
          platform: string
          external_id: string | null
          external_variant_id: string | null
          sync_status: string
          last_synced: string | null
          error_message: string | null
          error_count: number
          sync_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          platform: string
          external_id?: string | null
          external_variant_id?: string | null
          sync_status?: string
          last_synced?: string | null
          error_message?: string | null
          error_count?: number
          sync_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          platform?: string
          external_id?: string | null
          external_variant_id?: string | null
          sync_status?: string
          last_synced?: string | null
          error_message?: string | null
          error_count?: number
          sync_data?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      sync_logs: {
        Row: {
          id: string
          product_id: string
          platform: string
          operation: string
          status: string
          message: string | null
          request_data: Json | null
          response_data: Json | null
          execution_time: number | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          platform: string
          operation: string
          status: string
          message?: string | null
          request_data?: Json | null
          response_data?: Json | null
          execution_time?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          platform?: string
          operation?: string
          status?: string
          message?: string | null
          request_data?: Json | null
          response_data?: Json | null
          execution_time?: number | null
          created_at?: string
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          clerk_user_id: string
          preferences: Json
          dashboard_layout: Json
          notification_settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          clerk_user_id: string
          preferences?: Json
          dashboard_layout?: Json
          notification_settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          clerk_user_id?: string
          preferences?: Json
          dashboard_layout?: Json
          notification_settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type User = Database['public']['Tables']['users']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type PlatformConnection = Database['public']['Tables']['platform_connections']['Row']
export type ChannelMapping = Database['public']['Tables']['channel_mappings']['Row']
export type SyncLog = Database['public']['Tables']['sync_logs']['Row']
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row']

export type InsertUser = Database['public']['Tables']['users']['Insert']
export type InsertProduct = Database['public']['Tables']['products']['Insert']
export type InsertPlatformConnection = Database['public']['Tables']['platform_connections']['Insert']
export type InsertChannelMapping = Database['public']['Tables']['channel_mappings']['Insert']
export type InsertSyncLog = Database['public']['Tables']['sync_logs']['Insert']
export type InsertUserPreferences = Database['public']['Tables']['user_preferences']['Insert']

export type UpdateUser = Database['public']['Tables']['users']['Update']
export type UpdateProduct = Database['public']['Tables']['products']['Update']
export type UpdatePlatformConnection = Database['public']['Tables']['platform_connections']['Update']
export type UpdateChannelMapping = Database['public']['Tables']['channel_mappings']['Update']
export type UpdateSyncLog = Database['public']['Tables']['sync_logs']['Update']
export type UpdateUserPreferences = Database['public']['Tables']['user_preferences']['Update']

// Enums for better type safety
export enum SyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SUCCESS = 'success',
  ERROR = 'error'
}

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft'
}

export enum Platform {
  SHOPIFY = 'shopify',
  AMAZON = 'amazon'
}

export enum SyncOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

export enum LogStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning'
}

// Product dimensions interface
export interface ProductDimensions {
  length: number
  width: number
  height: number
  unit: 'in' | 'cm' | 'ft' | 'm'
}

// Shopify specific types
export interface ShopifyCredentials {
  access_token: string
  shop_domain: string
  scope: string
  expires_at?: string
}

export interface ShopifyConfiguration {
  auto_sync: boolean
  sync_inventory: boolean
  sync_prices: boolean
  sync_images: boolean
}

// Amazon specific types
export interface AmazonCredentials {
  seller_id: string
  marketplace_id: string
  access_token: string
  refresh_token: string
  expires_at: string
}

export interface AmazonConfiguration {
  auto_sync: boolean
  sync_inventory: boolean
  sync_prices: boolean
  fulfillment_type: 'FBA' | 'FBM'
}