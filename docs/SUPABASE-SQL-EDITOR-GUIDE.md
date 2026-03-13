# How to Use Supabase SQL Editor - Step by Step

Having trouble with the SQL Editor? No problem! Follow this visual guide.

## Step 1: Open Supabase Dashboard

1. Go to https://app.supabase.com
2. Sign in with your account
3. Click on your **StackSmart** project

You should see this screen:

```
┌─────────────────────────────────┐
│ Supabase Dashboard              │
├─────────────────────────────────┤
│ Left Sidebar:                   │
│ • Home                          │
│ • SQL Editor          ← Click   │
│ • Authentication      Here!     │
│ • Database                      │
│ • Storage                       │
│ • Realtime                      │
└─────────────────────────────────┘
```

---

## Step 2: Click "SQL Editor"

On the left sidebar, find **SQL Editor** and click it.

You should now see a mostly empty editor area with:
- A big blue button that says **"+ New Query"** (or just a **"+"**)
- An empty text area on the right

```
┌───────────────────────────────────────┐
│ SQL Editor                            │
├───────────────────────────────────────┤
│ Left:              │ Right:            │
│ + New Query        │ [Empty editor]    │
│ • Quick Start      │                   │
│ • Templates        │ Paste SQL here ↓  │
│                    │                   │
└───────────────────────────────────────┘
```

---

## Step 3: Create a New Query

Click the blue **"+ New Query"** button.

A new query editor should appear with:
- An empty text area
- A blue **RUN** button in the top right

```
┌──────────────────────────────────────┐
│ SELECT * FROM           [RUN] ← Click│
│                                      │
│ [Empty text area - ready for SQL]    │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

---

## Step 4: Copy the SQL Code

Now you need to copy the SQL from your file.

**Option A: From Your IDE (Recommended)**

1. Open this file in your code editor:
   `/backend/migrations/001_create_schema.sql`

2. Select ALL the text (Ctrl+A on Windows/Linux, Cmd+A on Mac)

3. Copy it (Ctrl+C or Cmd+C)

**Option B: Copy from Below**

The complete SQL is below in this guide. Copy it from there.

---

## Step 5: Paste the SQL into Supabase

In the Supabase SQL editor:

1. Click in the big empty text area
2. Paste the SQL (Ctrl+V or Cmd+V)

You should see the SQL code appear in the editor:

```
┌──────────────────────────────────────────┐
│ CREATE TABLE users_public (     [RUN] ←  │
│   id UUID REFERENCES auth.users(id)...   │
│   email TEXT NOT NULL UNIQUE,            │
│   ...                                    │
└──────────────────────────────────────────┘
```

---

## Step 6: Click the RUN Button

In the top right of the SQL editor, find the blue **"RUN"** button.

Click it.

```
┌──────────────────────────────────────────┐
│ CREATE TABLE users_public (     [RUN] ← │
│   id UUID REFERENCES auth.users(id)...   │ Click this!
│   email TEXT NOT NULL UNIQUE,            │
│   ...                                    │
└──────────────────────────────────────────┘
```

---

## Step 7: Wait for Completion

After clicking RUN, wait 5-10 seconds. You should see:

**Success message:**
```
✅ Success!
Query executed successfully.
Execution time: X ms
```

**Error message (if something's wrong):**
```
❌ Error
ERROR: relation "users_public" already exists
```

---

## Step 8: Verify Tables Were Created

Once the SQL runs successfully, verify the tables exist.

Create a new query and run this SQL:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users_public', 'financial_data', 'plaid_accounts');
```

**Expected result:**
You should see 3 rows:
- users_public
- financial_data
- plaid_accounts

---

## Complete SQL to Copy & Paste

If you have trouble finding the file, here's the complete SQL. Just copy this whole thing:

```sql
-- Create users_public table (extends Supabase auth.users)
CREATE TABLE users_public (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS (Row Level Security)
ALTER TABLE users_public ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own data
CREATE POLICY "Users can read own data" ON users_public
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users_public
  FOR UPDATE USING (auth.uid() = id);

-- Create index for email lookups
CREATE INDEX users_public_email_idx ON users_public(email);

-- Create financial_data table (for saving user's plans)
CREATE TABLE financial_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT financial_data_user_id_plan_name UNIQUE(user_id, plan_name)
);

ALTER TABLE financial_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own financial data" ON financial_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own financial data" ON financial_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own financial data" ON financial_data
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own financial data" ON financial_data
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX financial_data_user_id_idx ON financial_data(user_id);

-- Create plaid_accounts table (for storing Plaid token metadata)
CREATE TABLE plaid_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plaid_item_id TEXT NOT NULL,
  account_name TEXT,
  account_type TEXT,
  plaid_access_token TEXT NOT NULL ENCRYPTED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT plaid_accounts_user_id_item_id UNIQUE(user_id, plaid_item_id)
);

ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own Plaid accounts" ON plaid_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own Plaid accounts" ON plaid_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Plaid accounts" ON plaid_accounts
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX plaid_accounts_user_id_idx ON plaid_accounts(user_id);
```

Copy the entire block above and paste into Supabase SQL Editor, then click RUN.

---

## Troubleshooting

### Issue: "Nothing happens when I click RUN"

**Fix:**
1. Make sure you pasted SQL into the editor (not empty)
2. Click the RUN button again (sometimes it takes a moment)
3. Check if there's a loading spinner (might be running)

### Issue: "ERROR: relation 'users_public' already exists"

**Fix:**
The tables already exist! This is actually good. You don't need to run the SQL again.

To verify, run this query instead:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users_public', 'financial_data', 'plaid_accounts');
```

### Issue: "ERROR: syntax error"

**Fix:**
1. Make sure you copied the ENTIRE SQL file (not just part)
2. Try deleting what's there and pasting again
3. Make sure there are no extra spaces at the beginning

### Issue: "I don't see a RUN button"

**Fix:**
1. Look in the top-right corner of the SQL editor area
2. It should be a blue button
3. If you still don't see it, try clicking in the editor area first, then look again

### Issue: "The SQL Editor is blank/not loading"

**Fix:**
1. Refresh the page (F5 or Cmd+R)
2. Go back to the dashboard
3. Click SQL Editor again
4. Try a new query

---

## Quick Checklist

```
☐ I opened https://app.supabase.com
☐ I selected my StackSmart project
☐ I clicked "SQL Editor" in the left sidebar
☐ I clicked "+ New Query"
☐ I copied the SQL from the file or guide above
☐ I pasted it into the Supabase SQL editor
☐ I clicked the blue "RUN" button
☐ I waited 5-10 seconds
☐ I saw a success message (or a list of tables)
☐ Tables now exist in my database!
```

---

## Next Steps

After the SQL runs successfully:

1. **Verify it worked:**
   Run this query to check tables exist:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('users_public', 'financial_data', 'plaid_accounts');
   ```
   You should see 3 tables.

2. **Continue with testing:**
   See `/docs/QUICK-START-TESTING.md`

3. **Start your servers:**
   Backend + Frontend (as described in testing guide)

4. **Test authentication:**
   Sign up, login, and verify everything works!

---

## Still Stuck?

If you're still having trouble:

1. **Take a screenshot** of what you see in Supabase
2. **Check the error message** carefully (copy it)
3. **Read the troubleshooting section** above
4. **Try refreshing the page** (F5) and starting over

Still need help? Ask in the Supabase Discord or check their docs at https://supabase.com/docs
