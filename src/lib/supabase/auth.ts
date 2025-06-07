import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@/types/database'

/**
 * Get the authenticated user from Clerk and their corresponding Supabase user
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const { userId } = auth()
  
  if (!userId) {
    return null
  }

  const supabase = createClient()
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_user_id', userId)
    .single()

  if (error) {
    console.error('Error fetching user:', error)
    return null
  }

  return user
}

/**
 * Get the authenticated user's ID for use in queries
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getAuthenticatedUser()
  return user?.id || null
}

/**
 * Get the Clerk user ID from the current session
 */
export function getClerkUserId(): string | null {
  // For MVP demo - bypass auth check
  return 'demo-user-id'
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  // For MVP demo - bypass auth check
  return true
}

/**
 * Require authentication or throw error
 */
export function requireAuth(): string {
  // For MVP demo - bypass auth check
  return 'demo-user-id'
}