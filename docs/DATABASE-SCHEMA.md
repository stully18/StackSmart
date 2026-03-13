# StackSmart Database Schema

## Overview

This document describes the database schema for StackSmart, which runs on Supabase PostgreSQL. The schema is designed to store user authentication data, financial plans, and Plaid account connections while enforcing strict privacy through Row Level Security (RLS).

## Table Definitions

### 1. users_public

**Purpose:** Extends Supabase's built-in `auth.users` table with additional profile information.

**Columns:**
- `id` (UUID, PRIMARY KEY): Links to Supabase `auth.users(id)` - automatically managed by Supabase Auth
- `email` (TEXT, UNIQUE, NOT NULL): User's email address
- `full_name` (TEXT, NULLABLE): User's display name
- `avatar_url` (TEXT, NULLABLE): URL to user's profile picture
- `created_at` (TIMESTAMP WITH TIME ZONE): When the user profile was created
- `updated_at` (TIMESTAMP WITH TIME ZONE): When the profile was last updated

**Relationship:**
- Foreign Key to `auth.users(id)` with CASCADE delete
- When a user deletes their Supabase account, their profile is automatically deleted

**Indexes:**
- `users_public_email_idx` on `email` for fast lookups

**Security:**
- RLS enabled
- Users can only READ their own profile
- Users can only UPDATE their own profile

### 2. financial_data

**Purpose:** Stores user financial plans (debt vs invest, multi-loan, investment plans, etc.)

**Columns:**
- `id` (UUID, PRIMARY KEY): Unique identifier for this plan record
- `user_id` (UUID, NOT NULL): Links to the user who owns this plan
- `plan_name` (TEXT, NOT NULL): Name given to this plan by the user
- `plan_type` (TEXT, NOT NULL): Type of plan - one of:
  - `debt_vs_invest`: Compare debt payoff vs investment returns
  - `multi_loan`: Handle multiple loan scenarios
  - `investment_plan`: Long-term investment strategy
- `data` (JSONB, NOT NULL): Complete plan data stored as JSON, allowing flexibility for different plan types
- `created_at` (TIMESTAMP WITH TIME ZONE): When plan was created
- `updated_at` (TIMESTAMP WITH TIME ZONE): When plan was last modified

**Constraints:**
- Foreign Key to `auth.users(id)` with CASCADE delete
- UNIQUE constraint on `(user_id, plan_name)` - users can't have duplicate plan names

**Indexes:**
- `financial_data_user_id_idx` on `user_id` for fast retrieval of user's plans

**Security:**
- RLS enabled
- Users can only READ their own financial data
- Users can only CREATE new plans for themselves
- Users can only UPDATE their own plans
- Users can only DELETE their own plans

**Example Usage:**
```json
{
  "plan_name": "My Investment Strategy 2026",
  "plan_type": "investment_plan",
  "data": {
    "initial_investment": 50000,
    "monthly_contribution": 1000,
    "expected_annual_return": 0.07,
    "years": 30,
    "projected_values": [...]
  }
}
```

### 3. plaid_accounts

**Purpose:** Stores references to user's bank accounts connected via Plaid, including encrypted access tokens.

**Columns:**
- `id` (UUID, PRIMARY KEY): Unique identifier for this connection record
- `user_id` (UUID, NOT NULL): Links to the user who connected this account
- `plaid_item_id` (TEXT, NOT NULL): Plaid's unique identifier for this item/connection
- `account_name` (TEXT, NULLABLE): User-friendly name for the account
- `account_type` (TEXT, NULLABLE): Type of account - one of:
  - `checking`: Checking account
  - `savings`: Savings account
  - `credit`: Credit card
  - `investment`: Brokerage/investment account
  - `loan`: Loan account
- `plaid_access_token` (TEXT, NOT NULL, ENCRYPTED): Encrypted token for Plaid API calls (Supabase automatically encrypts this column)
- `created_at` (TIMESTAMP WITH TIME ZONE): When connection was established

**Constraints:**
- Foreign Key to `auth.users(id)` with CASCADE delete
- UNIQUE constraint on `(user_id, plaid_item_id)` - users can't connect the same Plaid item twice

**Indexes:**
- `plaid_accounts_user_id_idx` on `user_id` for fast retrieval of user's connections

**Security:**
- RLS enabled
- Users can only READ their own Plaid accounts
- Users can only CREATE new connections for themselves
- Users can only DELETE their own connections
- **Note:** No UPDATE policy - connections should be recreated rather than updated
- Access tokens are encrypted at rest in Supabase

## Row Level Security (RLS)

### What is RLS?

Row Level Security is PostgreSQL's built-in feature that enforces row-level access control. At the database layer, each row is protected by policies that determine who can SELECT, INSERT, UPDATE, or DELETE that row.

### Why RLS is Critical for StackSmart

1. **User Privacy**: Users absolutely cannot see other users' financial data, even if they somehow know their user IDs
2. **Data Protection**: The database enforces privacy rules, not just the application - this protects against application bugs
3. **Compliance**: Helps meet financial data privacy requirements
4. **Supabase Integration**: Works seamlessly with Supabase's `auth.uid()` function to identify the current user

### How Policies Work

Each policy uses `auth.uid()` to get the current authenticated user's ID and compares it to the user's data:

```sql
CREATE POLICY "Users can read own data" ON users_public
  FOR SELECT USING (auth.uid() = id);
```

This policy says: "For SELECT operations, only show rows where the authenticated user's ID matches the row's ID field."

### Security Model

- **Unauthenticated users**: Cannot access any data (RLS blocks all queries)
- **Authenticated users**: Can only see/modify their own data
- **Service role key**: Bypasses RLS (use only in backend functions - never expose to client)

## How to Run the Migration

### Option 1: Using Supabase SQL Editor (Recommended for Development)

1. Log into your [Supabase Dashboard](https://app.supabase.com)
2. Select your StackSmart project
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `backend/migrations/001_create_schema.sql`
6. Paste into the SQL editor
7. Click **RUN** (or press Ctrl+Enter)
8. Verify all statements executed successfully (no red errors)

### Option 2: Using Supabase CLI (For Production/Automation)

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-id your-project-id

# Run migrations
supabase migration up

# Or push all changes
supabase db push
```

### Option 3: Using psql Directly

```bash
# Get your Supabase connection string from Settings > Database
psql postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres < backend/migrations/001_create_schema.sql
```

## How to Verify the Migration Worked

### Via Supabase Dashboard

1. Go to **Table Editor** in the left sidebar
2. You should see three new tables:
   - `users_public`
   - `financial_data`
   - `plaid_accounts`
3. Click each table to verify columns match the schema above

### Via SQL Query

Run this query in the SQL Editor to verify table creation:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users_public', 'financial_data', 'plaid_accounts');
```

Expected output: 3 rows with the three table names

### Verify RLS Policies

Run this to verify RLS is enabled and policies exist:

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('users_public', 'financial_data', 'plaid_accounts');
```

Expected: All three tables should show `rowsecurity | true`

### Verify Indexes

Run this to check indexes were created:

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename IN ('users_public', 'financial_data', 'plaid_accounts');
```

Expected output should include:
- `users_public_email_idx`
- `financial_data_user_id_idx`
- `plaid_accounts_user_id_idx`

## Testing the Security Model

### Test 1: Verify RLS Blocks Unauthenticated Access

1. Open an **Incognito Window** (no Supabase session)
2. Try to fetch from the API without authentication
3. Should receive a permission denied error

### Test 2: Verify Users Can Only See Their Own Data

1. Sign up as User A
2. Create a financial plan
3. Note the user ID from the auth token
4. Sign in as User B
5. Try to query: `SELECT * FROM financial_data WHERE user_id = 'User A ID'`
6. Should return 0 rows (User B can't see User A's data)

### Test 3: Insert Prevention

1. Sign in as User A
2. Try to insert data with `user_id = 'User B ID'`
3. Should get a permission denied error (RLS prevents it)

## Database Encryption

- The `plaid_access_token` column is marked `ENCRYPTED` in Supabase
- Supabase automatically encrypts sensitive data at rest
- The encryption key is managed by Supabase and rotates automatically
- Tokens are encrypted in database backups

## Next Steps

After running this migration:

1. **Create a trigger** to auto-insert user profiles when users sign up (see Supabase Auth documentation)
2. **Connect the backend** API to read/write from these tables
3. **Add user data** via frontend signup flow
4. **Connect Plaid** to populate `plaid_accounts` table
5. **Store plans** in `financial_data` when users create analysis

## Troubleshooting

### Error: "relation 'auth.users' does not exist"

This means Supabase Auth is not set up. Make sure you've enabled Auth in your Supabase project.

### Error: "User does not have CONNECT privilege"

Make sure you're running the migration with the correct Supabase credentials.

### Error: "Row-level security is disabled for role"

The RLS policies may not have been created. Verify all `CREATE POLICY` statements executed without errors.

### Tables exist but no data shows up

This is likely correct - RLS is working! If you try to query as the wrong user, you get 0 rows. Make sure you're authenticated as the user who owns the data.

## File Reference

- Migration file: `/backend/migrations/001_create_schema.sql`
- This documentation: `/docs/DATABASE-SCHEMA.md`
