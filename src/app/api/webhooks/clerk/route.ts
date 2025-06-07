import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createClient } from '@/lib/supabase/server'
import type { InsertUser, UpdateUser } from '@/types/database'

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

if (!webhookSecret) {
  throw new Error('CLERK_WEBHOOK_SECRET is not set')
}

type ClerkUser = {
  id: string
  email_addresses: Array<{
    email_address: string
    id: string
  }>
  first_name: string | null
  last_name: string | null
  image_url: string
  created_at: number
  updated_at: number
}

type ClerkWebhookEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted'
  data: ClerkUser
}

export async function POST(req: NextRequest) {
  try {
    // Get headers
    const headerPayload = headers()
    const svix_id = headerPayload.get('svix-id')
    const svix_timestamp = headerPayload.get('svix-timestamp')
    const svix_signature = headerPayload.get('svix-signature')

    // Verify required headers
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json(
        { error: 'Missing Svix headers' },
        { status: 400 }
      )
    }

    // Get the request body
    const payload = await req.text()

    // Create Svix webhook instance
    const wh = new Webhook(webhookSecret)

    let evt: ClerkWebhookEvent

    // Verify the webhook signature
    try {
      evt = wh.verify(payload, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as ClerkWebhookEvent
    } catch (err) {
      console.error('Error verifying webhook:', err)
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      )
    }

    // Handle the webhook event
    const { type, data } = evt
    const supabase = createClient()

    switch (type) {
      case 'user.created':
        await handleUserCreated(supabase, data)
        break
      case 'user.updated':
        await handleUserUpdated(supabase, data)
        break
      case 'user.deleted':
        await handleUserDeleted(supabase, data)
        break
      default:
        console.log(`Unhandled event type: ${type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleUserCreated(supabase: any, user: ClerkUser) {
  try {
    const primaryEmail = user.email_addresses.find(email => email.id === user.email_addresses[0]?.id)
    
    if (!primaryEmail) {
      console.error('No primary email found for user:', user.id)
      return
    }

    const userData: InsertUser = {
      clerk_user_id: user.id,
      email: primaryEmail.email_address,
      first_name: user.first_name,
      last_name: user.last_name,
      image_url: user.image_url,
      clerk_metadata: user,
    }

    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single()

    if (error) {
      console.error('Error creating user in Supabase:', error)
      throw error
    }

    console.log('User created successfully:', data.id)

    // Create default user preferences
    await supabase
      .from('user_preferences')
      .insert({
        user_id: data.id,
        clerk_user_id: user.id,
        preferences: {
          theme: 'system',
          notifications: true,
          auto_sync: false,
        },
        dashboard_layout: {
          widgets: ['overview', 'recent_products', 'sync_status'],
        },
        notification_settings: {
          email_on_sync_error: true,
          email_on_sync_success: false,
          push_notifications: true,
        },
      })
  } catch (error) {
    console.error('Error in handleUserCreated:', error)
    throw error
  }
}

async function handleUserUpdated(supabase: any, user: ClerkUser) {
  try {
    const primaryEmail = user.email_addresses.find(email => email.id === user.email_addresses[0]?.id)
    
    if (!primaryEmail) {
      console.error('No primary email found for user:', user.id)
      return
    }

    const updateData: UpdateUser = {
      email: primaryEmail.email_address,
      first_name: user.first_name,
      last_name: user.last_name,
      image_url: user.image_url,
      clerk_metadata: user,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('clerk_user_id', user.id)

    if (error) {
      console.error('Error updating user in Supabase:', error)
      throw error
    }

    console.log('User updated successfully:', user.id)
  } catch (error) {
    console.error('Error in handleUserUpdated:', error)
    throw error
  }
}

async function handleUserDeleted(supabase: any, user: ClerkUser) {
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('clerk_user_id', user.id)

    if (error) {
      console.error('Error deleting user from Supabase:', error)
      throw error
    }

    console.log('User deleted successfully:', user.id)
  } catch (error) {
    console.error('Error in handleUserDeleted:', error)
    throw error
  }
}