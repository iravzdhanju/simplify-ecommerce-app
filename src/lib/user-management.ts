/**
 * On-Demand User Management for Native Clerk + Supabase Integration
 * 
 * This approach creates user records in your database only when needed,
 * while still leveraging the native integration for authentication.
 */

import { auth, currentUser } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import type { InsertUser, User } from '@/types/database'

/**
 * Get or create user in database
 * This function will:
 * 1. Check if user exists in your database
 * 2. If not, create them using Clerk data
 * 3. Return the user record
 */
export async function ensureUserInDatabase(): Promise<User | null> {
    try {
        const { userId } = await auth()
        if (!userId) return null

        const supabase = await createClient()

        // Try to find existing user
        const { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('clerk_user_id', userId)
            .single()

        if (existingUser && !findError) {
            return existingUser
        }

        // User doesn't exist, create them
        const clerkUser = await currentUser()
        if (!clerkUser) return null

        const userData: InsertUser = {
            clerk_user_id: userId,
            email: clerkUser.emailAddresses[0]?.emailAddress || '',
            first_name: clerkUser.firstName,
            last_name: clerkUser.lastName,
            image_url: clerkUser.imageUrl,
            clerk_metadata: {
                id: clerkUser.id,
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                emailAddresses: clerkUser.emailAddresses.map(email => ({
                    emailAddress: email.emailAddress,
                    id: email.id
                })),
                imageUrl: clerkUser.imageUrl,
                createdAt: clerkUser.createdAt ? new Date(clerkUser.createdAt).toISOString() : null,
                updatedAt: clerkUser.updatedAt ? new Date(clerkUser.updatedAt).toISOString() : null
            },
        }

        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert(userData)
            .select()
            .single()

        if (createError) {
            console.error('Error creating user:', createError)
            return null
        }

        console.log('User created in database:', newUser.id)
        return newUser
    } catch (error) {
        console.error('Error in ensureUserInDatabase:', error)
        return null
    }
}

/**
 * Get user from database (without creating)
 */
export async function getUserFromDatabase(): Promise<User | null> {
    try {
        const { userId } = await auth()
        if (!userId) return null

        const supabase = await createClient()

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('clerk_user_id', userId)
            .single()

        if (error) {
            return null
        }

        return user
    } catch (error) {
        console.error('Error getting user from database:', error)
        return null
    }
}

/**
 * Example usage in a component or API route:
 */

/*
// Server component example
export default async function ProfilePage() {
  const user = await ensureUserInDatabase()
  
  if (!user) {
    return <div>Please sign in</div>
  }

  return (
    <div>
      <h1>Welcome {user.first_name}!</h1>
      <p>Email: {user.email}</p>
      <p>Member since: {new Date(user.created_at).toLocaleDateString()}</p>
    </div>
  )
}

// API route example
export async function POST(req: Request) {
  const user = await ensureUserInDatabase()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Now you can use user.id for foreign keys
  const result = await supabase
    .from('posts')
    .insert({
      title: 'My Post',
      user_id: user.id, // Use database user ID
      content: 'Post content'
    })

  return NextResponse.json(result)
}
*/ 