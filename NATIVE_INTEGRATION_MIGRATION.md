# Migration Guide: JWT Template → Native Clerk + Supabase Integration

## Overview

This guide will help you migrate from the deprecated Clerk JWT template approach to the new native Clerk + Supabase integration. The native integration is simpler, more reliable, and the recommended approach going forward.

## Benefits of Native Integration

✅ **No manual token fetching** - Automatic token management  
✅ **No JWT secret sharing** - Supabase verifies directly with Clerk  
✅ **Simplified setup** - Less configuration required  
✅ **Better performance** - Reduced token overhead  
✅ **Automatic user sync** - Optional, but users can be created on-demand

## Migration Steps

### 1. Enable Clerk as Third-Party Auth Provider in Supabase

1. **Go to Supabase Dashboard** → **Authentication** → **Sign In/Up** → **Third Party Auth**
2. **Add Clerk as provider**
3. **Get your Clerk domain**:
   - In Clerk Dashboard → **Configure** → **Supabase integration setup**
   - Enable the integration to get your domain (e.g., `modest-hog-24.clerk.accounts.dev`)
4. **Add domain in Supabase** and save

**For Local Development with Supabase CLI (Optional):**
Only needed if running Supabase locally with CLI (not needed for Vercel + Supabase cloud):

```toml
# supabase/config.toml
[auth.third_party.clerk]
enabled = true
domain = "your-clerk-domain.clerk.accounts.dev"
```

### 2. Update Environment Variables

Remove JWT template related variables and keep only:

```bash
# Required
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...your_anon_key

# Optional (only needed for admin operations)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...your_service_role_key
```

**Remove these (no longer needed):**

```bash
CLERK_WEBHOOK_SECRET=whsec_... # ❌ Remove
```

### 3. Update Supabase Client Configuration

**Before (JWT Template):**

```typescript
import { createClient } from '@supabase/supabase-js';
import { useSession } from '@clerk/nextjs';

const { session } = useSession();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!,
  {
    global: {
      fetch: async (url, options = {}) => {
        const clerkToken = await session?.getToken({
          template: 'supabase' // ❌ Template no longer needed
        });
        const headers = new Headers(options?.headers);
        headers.set('Authorization', `Bearer ${clerkToken}`);
        return fetch(url, { ...options, headers });
      }
    }
  }
);
```

**After (Native Integration):**

```typescript
import { createClient } from '@supabase/supabase-js';
import { useSession } from '@clerk/nextjs';

const { session } = useSession();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!,
  {
    async accessToken() {
      return session?.getToken() ?? null; // ✅ Simple, no template needed
    }
  }
);
```

### 4. Update Server-Side Usage

**Before:**

```typescript
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const { getToken } = auth();
const supabase = createClient(url, key, {
  global: {
    fetch: async (url, options = {}) => {
      const token = await getToken({ template: 'supabase' });
      // ... manual header setup
    }
  }
});
```

**After:**

```typescript
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key, {
  async accessToken() {
    return (await auth()).getToken(); // ✅ Simple and clean
  }
});
```

### 5. Remove Webhook Handler (Recommended)

With the native integration, **webhooks are NOT needed**. The native integration handles all user authentication and data access automatically through RLS policies.

**Remove the webhook entirely:**

```bash
# Delete the webhook file
rm src/app/api/webhooks/clerk/route.ts
```

**Remove webhook environment variable:**

```bash
# Remove from .env.local
# CLERK_WEBHOOK_SECRET=whsec_... # ❌ Not needed
```

**Why remove webhooks?**

- ✅ Native integration handles everything automatically
- ✅ No manual user sync needed
- ✅ RLS policies provide all necessary access control
- ✅ Simpler architecture with fewer moving parts
- ✅ No webhook endpoint to secure or maintain

### 6. Update RLS Policies (No Changes Needed!)

Your existing RLS policies using `auth.jwt() ->> 'sub'` will continue to work:

```sql
-- ✅ These policies work with native integration
CREATE POLICY "Users can view own data" ON table_name
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);
```

### 7. Test the Migration

1. **Remove old JWT template** from Clerk Dashboard
2. **Test authentication flow**:
   ```typescript
   // This should work seamlessly
   const { data } = await supabase.from('your_table').select('*');
   ```
3. **Verify RLS policies** are working correctly
4. **Check that tokens are being validated** properly

## Optional: User Management Strategies

With native integration, you have flexibility in how to handle users:

### Strategy 1: No User Table (Simplest)

- Use Clerk user ID directly in your RLS policies
- No need to sync users to your database
- Best for simple applications

### Strategy 2: On-Demand User Creation

```typescript
// Create user record when first needed
async function ensureUser() {
  const clerkUserId = await getClerkUserId();

  // Try to get existing user
  let { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single();

  // Create if doesn't exist
  if (!user) {
    const { data } = await supabase
      .from('users')
      .insert({ clerk_user_id: clerkUserId })
      .select()
      .single();
    user = data;
  }

  return user;
}
```

### Strategy 3: Database Trigger (Automatic)

```sql
-- Auto-create user record on first data insert
CREATE OR REPLACE FUNCTION create_user_if_not_exists()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (clerk_user_id)
  VALUES (auth.jwt() ->> 'sub')
  ON CONFLICT (clerk_user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables that need user records
CREATE TRIGGER ensure_user_exists
  BEFORE INSERT ON your_main_table
  FOR EACH ROW
  EXECUTE FUNCTION create_user_if_not_exists();
```

## Troubleshooting

### Issue: "Invalid JWT" errors

**Solution**: Ensure you've added Clerk as a third-party auth provider in Supabase

### Issue: RLS policies not working

**Solution**: Verify the Clerk domain is correctly configured in Supabase

### Issue: User not found errors

**Solution**: With native integration, users aren't automatically created in your database. Choose one of the user management strategies above.

## Summary

The native integration is much simpler:

❌ **Before**: Manual JWT templates, webhook user sync, complex client setup  
✅ **After**: Simple `accessToken` function, optional user sync, cleaner code

The migration typically takes 15-30 minutes and results in more maintainable code.
