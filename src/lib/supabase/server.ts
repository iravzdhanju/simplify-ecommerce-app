import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase is not configured, throw a descriptive error
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing. Please check your environment variables.')
  }

  try {
    return createSupabaseClient(
      supabaseUrl,
      supabaseKey,
      {
        async accessToken() {
          return (await auth()).getToken()
        },
      }
    )
  } catch (error) {
    throw new Error(`Failed to create Supabase client: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Service role client that bypasses RLS policies
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role configuration missing. Please check SUPABASE_SERVICE_ROLE_KEY environment variable.')
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}