-- Create stock_of_the_day_picks table (one row per day: the winning ticker + full factor breakdown)
CREATE TABLE stock_of_the_day_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_date DATE NOT NULL,
  ticker TEXT NOT NULL,
  composite_score NUMERIC NOT NULL,
  factor_breakdown JSONB NOT NULL,  -- per-factor {raw_value, zscore, weight, weighted_contribution}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stock_of_the_day_picks_pick_date UNIQUE(pick_date)
);

-- Enable RLS (Row Level Security)
-- This data is global/non-user-specific (unlike every other table in this
-- schema). All reads and writes go through the backend's service-role
-- Supabase client, which bypasses RLS entirely — the FastAPI layer enforces
-- login via Depends(verify_user_token) instead. The public-read policy below
-- is defense-in-depth only, in case an anon/authenticated-key client ever
-- queries this table directly; no INSERT/UPDATE/DELETE policy is defined,
-- so only the service-role key can write.
ALTER TABLE stock_of_the_day_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stock of the day picks" ON stock_of_the_day_picks
  FOR SELECT USING (true);

CREATE INDEX stock_of_the_day_picks_pick_date_idx ON stock_of_the_day_picks(pick_date);
CREATE INDEX stock_of_the_day_picks_ticker_idx ON stock_of_the_day_picks(ticker);

-- Create stock_of_the_day_performance table (backfilled once 1d/5d/20d windows pass)
CREATE TABLE stock_of_the_day_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_date DATE NOT NULL REFERENCES stock_of_the_day_picks(pick_date) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  price_at_pick NUMERIC NOT NULL,
  price_1d NUMERIC,
  price_5d NUMERIC,
  price_20d NUMERIC,
  return_1d NUMERIC,
  return_5d NUMERIC,
  return_20d NUMERIC,
  spy_return_1d NUMERIC,
  spy_return_5d NUMERIC,
  spy_return_20d NUMERIC,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stock_of_the_day_performance_pick_date UNIQUE(pick_date)
);

ALTER TABLE stock_of_the_day_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stock of the day performance" ON stock_of_the_day_performance
  FOR SELECT USING (true);

CREATE INDEX stock_of_the_day_performance_pick_date_idx ON stock_of_the_day_performance(pick_date);

-- Create factor_weights_config table (versioned weight sets, auditable/backtestable)
CREATE TABLE factor_weights_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  weights JSONB NOT NULL,  -- {"momentum":0.20,"volume":0.15,"analyst_revision":0.15,"news_sentiment":0.20,"technical_setup":0.10,"vol_adjusted_momentum":0.20}
  is_active BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT factor_weights_config_version UNIQUE(version)
);

ALTER TABLE factor_weights_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read factor weights config" ON factor_weights_config
  FOR SELECT USING (true);

CREATE INDEX factor_weights_config_is_active_idx ON factor_weights_config(is_active);

-- Create market_data_cache table (Postgres-backed TTL cache in front of Alpha Vantage calls — no Redis in this infra)
CREATE TABLE market_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,  -- 'alpha_vantage', 'yfinance', etc.
  cache_key TEXT NOT NULL,  -- typically the ticker, or ticker+params
  response JSONB NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ttl_seconds INTEGER NOT NULL,
  CONSTRAINT market_data_cache_provider_key UNIQUE(provider, cache_key)
);

ALTER TABLE market_data_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market data cache" ON market_data_cache
  FOR SELECT USING (true);

CREATE INDEX market_data_cache_fetched_at_idx ON market_data_cache(fetched_at);

-- Seed the initial default weight set (matches DEFAULT_WEIGHTS in stock_of_the_day_service.py)
INSERT INTO factor_weights_config (version, weights, is_active, notes) VALUES
(1, '{"momentum":0.20,"volume":0.15,"analyst_revision":0.15,"news_sentiment":0.20,"technical_setup":0.10,"vol_adjusted_momentum":0.20}'::jsonb, true, 'Initial default weights per product spec');
