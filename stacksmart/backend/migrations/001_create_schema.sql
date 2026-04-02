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

CREATE POLICY "Users can insert own profile during signup" ON users_public
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users_public
  FOR UPDATE USING (auth.uid() = id);

-- Create index for email lookups
CREATE INDEX users_public_email_idx ON users_public(email);

-- Create financial_data table (for saving user's plans)
CREATE TABLE financial_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL,  -- 'debt_vs_invest', 'multi_loan', 'investment_plan'
  data JSONB NOT NULL,      -- Store full plan data as JSON
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
  account_type TEXT,  -- 'checking', 'savings', 'credit', etc.
  plaid_access_token TEXT NOT NULL,  -- Store encrypted
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
