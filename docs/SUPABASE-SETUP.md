# Supabase Setup Guide for StackSmart

This guide walks you through creating a Supabase project and configuring it for StackSmart authentication. Even if you're not technical, follow these steps exactly and you'll have everything working.

## What is Supabase?

Supabase is an open-source Firebase alternative that provides:
- User authentication (sign up, login, password reset)
- PostgreSQL database for storing user data
- Real-time database subscriptions
- Built-in security with row-level security (RLS)

## Prerequisites

- Email address (Gmail, Outlook, etc.)
- Internet connection
- 5-10 minutes of time

## Step-by-Step Setup

### Step 1: Create a Supabase Account

1. Go to https://supabase.com
2. Click the **"Start your project"** or **"Sign Up"** button
3. Click **"Sign up with GitHub"** OR **"Sign up with Google"**
   - We recommend GitHub if you have an account, but Google works just as well
4. Complete the authentication process
5. You'll be redirected to your dashboard

### Step 2: Create Your First Project

1. On the Supabase dashboard, click **"New Project"** (or similar)
2. You'll see a project creation form. Fill it out:
   - **Project Name**: `StackSmart` (or any name you prefer)
   - **Database Password**: Create a strong password like `YourSecurePassword123!` and SAVE THIS
   - **Region**: Pick the region closest to you (e.g., `us-east-1` for East Coast, `us-west-1` for West Coast)
   - **Pricing Plan**: Select **Free** tier
3. Click **"Create new project"**
4. Wait 2-3 minutes while Supabase creates your database

> **IMPORTANT**: You'll see a message saying "Your project is being set up" - DO NOT close this page. Wait for it to complete.

### Step 3: Get Your Project Credentials

Once your project is created, follow these steps to find your credentials:

#### Finding Your Credentials:

1. Click on your project name (e.g., "StackSmart") in the dashboard
2. On the left sidebar, go to **Settings** (gear icon at the bottom)
3. Click on **API** in the Settings menu
4. You'll see a section labeled **"Project API keys"**

**You need two keys that look like this:**
- **Anon Key** (or "anon public"): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)
- **Service Role Key** (or "service_role"): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (even longer string)

**Also get:**
- **Project URL**: `https://xxxxxxxxxxxxxx.supabase.co` (shown at the top of the API page)

#### What These Mean:

- **Project URL**: Your unique Supabase database endpoint
- **Anon Key**: Public key used by the frontend (safe to expose in browser code)
- **Service Role Key**: Secret key for backend only (NEVER share this)

> **SECURITY NOTE**: Keep the Service Role Key secret. It has full database access.

### Step 4: Add Credentials to Backend (.env file)

1. Open this file: `net-worth-optimizer/backend/.env`
2. Add these lines (replace with YOUR actual values):

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to get these values:**
- Copy your **Project URL** and paste after `SUPABASE_URL=`
- Copy your **Service Role Key** and paste after `SUPABASE_SERVICE_ROLE_KEY=`

> **Example** (yours will be different):
> ```env
> SUPABASE_URL=https://fbgrtbkwdsjiwxyz.supabase.co
> SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3J0Ymt3ZHNqaXd4eXoiLCJyb2xlIjoic2VydmljZV9yb2xlIn0.abc123...
> ```

### Step 5: Add Credentials to Frontend (.env.local file)

1. Open or create this file: `net-worth-optimizer/frontend/.env.local`
2. Add these lines (replace with YOUR actual values):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to get these values:**
- Copy your **Project URL** and paste after `NEXT_PUBLIC_SUPABASE_URL=`
- Copy your **Anon Key** and paste after `NEXT_PUBLIC_SUPABASE_ANON_KEY=`

> **Note**: The frontend uses the **Anon Key** (not Service Role Key). The `NEXT_PUBLIC_` prefix means it's safe to expose in the browser.

### Step 6: Verify Your Credentials

Once you've filled in both .env files, you can test the connection:

**For Backend (Node.js/Python):**
```bash
cd net-worth-optimizer/backend
# The backend will load the .env file on startup
# You should see no errors related to Supabase
```

**For Frontend (Next.js):**
```bash
cd net-worth-optimizer/frontend
npm install supabase@latest
npm run dev
# Check the browser console for any errors
# You should NOT see "SUPABASE_URL is undefined"
```

### Step 7: Initialize Database Schema (Optional but Recommended)

Once connected, you may want to set up tables for users. Go to:

1. **SQL Editor** in the Supabase dashboard
2. Click **New query**
3. Paste and run this basic schema:

```sql
-- Create a profiles table (extends Supabase auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

## Troubleshooting

### Q: Where do I find my credentials again?
**A**: In the Supabase dashboard, go to **Settings** → **API**. You'll see all keys there.

### Q: I can't see the API page
**A**: Make sure you're in the correct project. Check the top-left of the dashboard - it should say your project name.

### Q: The .env file isn't working
**A**:
1. Make sure there are NO spaces around the `=` sign
2. Don't use quotes around values
3. Correct: `SUPABASE_URL=https://...`
4. Wrong: `SUPABASE_URL = "https://..."`

### Q: My backend still can't connect
**A**: Check that:
1. The URL is exactly as shown in Supabase (includes `https://`)
2. The Service Role Key is complete (very long string)
3. Your internet connection is working
4. There are no typos in the URL

### Q: My frontend shows "SUPABASE_URL is undefined"
**A**: This means `.env.local` isn't being loaded. Try:
1. Stopping the dev server (`CTRL+C`)
2. Deleting the `.next` folder: `rm -rf .next`
3. Restarting: `npm run dev`

### Q: Do I need both keys?
**A**: Yes!
- **Backend uses Service Role Key** (has full access, keep it secret)
- **Frontend uses Anon Key** (limited access, safe to expose)

## What's Next?

Once Supabase is configured:
1. Users can now sign up and log in
2. Each user gets a unique ID in Supabase
3. You can add additional databases tables as needed
4. You can enable advanced features like real-time subscriptions

For more information, visit [Supabase Documentation](https://supabase.com/docs).

## Reference: Credential Format

Here's what your credentials should look like:

```
Project URL: https://fbgrtbkwdsjiwxyz.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3J0Ymt3ZHNqaXd4eXoiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMzk0NzE0MCwiZXhwIjoxNjM1NDgzMTQwfQ.abc123xyz...
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3J0Ymt3ZHNqaXd4eXoiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjAzOTQ3MTQwLCJleHAiOjE2MzU0ODMxNDB9.def456uvw...
```

All three are REQUIRED. The keys are long strings starting with `eyJhbGc...` (JWT format).
