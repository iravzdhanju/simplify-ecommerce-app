'use client'

import { createClient } from '@supabase/supabase-js'
import { useSession } from '@clerk/nextjs'

export function useSupabaseClient() {
  const { session } = useSession()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing. Please check your environment variables.')
  }

  return createClient(
    supabaseUrl,
    supabaseKey,
    {
      async accessToken() {
        return session?.getToken() ?? null
      },
    }
  )
}