import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@/types/database'

/**
 * Get the authenticated user from Clerk and their corresponding Supabase user
 * Note: With native integration, users may not exist in your users table
 * until you explicitly create them or use a trigger
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const { userId } = await auth()

  if (!userId) {
    return null
  }

  const supabase = await createClient()

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_user_id', userId)
    .single()

  if (error) {
    // User might not exist in your users table with native integration
    // This is normal - you can choose to create users on-demand or via triggers
    console.debug('User not found in users table:', userId)
    return null
  }

  return user
}

/**
 * Get the authenticated user's ID (Supabase table ID, not Clerk ID)
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getAuthenticatedUser()
  return user?.id || null
}

/**
 * Get the Clerk user ID from the current session
 */
export async function getClerkUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { userId } = await auth()
  return !!userId
}

/**
 * Require authentication or throw error
 */
export async function requireAuth(): Promise<string> {
  const { userId } = await auth()
  console.log(`USER IS AUTHENTICATED NOW : ${userId}`)
  if (!userId) {
    throw new Error('Authentication required')
  }
  return userId
}