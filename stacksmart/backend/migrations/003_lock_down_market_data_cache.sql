-- market_data_cache holds raw cached provider responses (Alpha Vantage news
-- sentiment payloads, yfinance analyst-action history). Unlike the other
-- Stock of the Day tables, there is no product reason for this to be
-- publicly readable — it's internal plumbing for the cron job, not
-- user-facing data. Drop the public-read policy; the service-role key
-- (used exclusively by the backend cache layer) bypasses RLS entirely, so
-- no INSERT/SELECT/UPDATE/DELETE policy is needed for legitimate access.
DROP POLICY IF EXISTS "Anyone can read market data cache" ON market_data_cache;
