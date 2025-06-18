# Vercel + Supabase Cloud + Clerk Setup Guide

## For Users with Vercel-Supabase Integration

If you're using **Supabase cloud** with **Vercel integration**, this simplified guide is for you.

### ✅ **What You Have (Already Configured via Vercel):**

- ✅ Supabase project hosted in the cloud
- ✅ Vercel automatically manages environment variables
- ✅ Database connection is handled by Vercel integration

### 🎯 **What You Need to Do:**

### 1. **Configure Clerk Integration in Supabase Dashboard**

1. **Go to Supabase Dashboard** → **Authentication** → **Sign In/Up** → **Third Party Auth**
2. **Click "Add provider"** and select **Clerk**
3. **Get your Clerk domain**:
   - Go to Clerk Dashboard → **Configure** → **Supabase integration setup**
   - Click **"Activate Supabase integration"**
   - Copy the domain (e.g., `modest-hog-24.clerk.accounts.dev`)
4. **Paste the domain** in Supabase and save

### 2. **Verify Environment Variables in Vercel**

Check that these are set in your Vercel project settings:

```bash
# Usually auto-configured by Vercel's Supabase integration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# Add these for Clerk (if not already present)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### 3. **Your Code Is Ready!**

The native integration code you have will work automatically:

```typescript
// ✅ This works with Vercel + Supabase cloud
const supabase = useSupabaseClient();
const { data } = await supabase.from('your_table').select('*');
// RLS automatically filters by authenticated user
```

### 4. **Test Your Setup**

1. **Deploy to Vercel** (or test locally)
2. **Sign in with Clerk**
3. **Verify data queries work** and are filtered by user

### ❌ **What You DON'T Need:**

- ~~Supabase CLI configuration~~ - You're using hosted Supabase
- ~~Local Supabase setup~~ - Vercel handles the connection
- ~~Manual environment variable setup~~ - Vercel integration does this
- ~~supabase/config.toml~~ - Only needed for local CLI development
- ~~Clerk webhooks~~ - Native integration handles everything automatically

### 🚀 **Deployment Notes:**

1. **Vercel automatically detects** your Supabase integration
2. **Environment variables sync** between Vercel and Supabase
3. **Your RLS policies** work exactly the same in production
4. **Clerk authentication** works seamlessly across environments

### 🔧 **If You Need Database Changes:**

1. **Go to Supabase Dashboard** → **SQL Editor**
2. **Run your schema changes** (like the example tasks table)
3. **Changes apply immediately** to your Vercel-connected app

### 🧪 **Quick Test:**

Create the example tasks table in Supabase:

```sql
-- Run this in Supabase Dashboard → SQL Editor
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT (auth.jwt() ->> 'sub'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can insert own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);
```

Then use the example component to test!

---

**🎉 That's it! Your Vercel + Supabase cloud setup with Clerk is ready to go.**
