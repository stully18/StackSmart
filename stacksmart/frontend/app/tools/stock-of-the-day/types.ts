export interface FactorDetail {
  raw_value: number | null;
  zscore: number;
  weight: number;
  weighted_contribution: number;
}

export interface FactorBreakdown {
  momentum: FactorDetail;
  volume: FactorDetail;
  analyst_revision: FactorDetail;
  news_sentiment: FactorDetail;
  technical_setup: FactorDetail;
  vol_adjusted_momentum: FactorDetail;
}

export interface StockOfTheDayPick {
  id: string;
  pick_date: string;
  ticker: string;
  composite_score: number;
  factor_breakdown: FactorBreakdown;
  created_at: string;
}

export const FACTOR_KEYS: (keyof FactorBreakdown)[] = [
  'momentum',
  'volume',
  'analyst_revision',
  'news_sentiment',
  'technical_setup',
  'vol_adjusted_momentum',
];

export const FACTOR_LABELS: Record<keyof FactorBreakdown, string> = {
  momentum: 'Momentum vs S&P 500',
  volume: 'Volume Anomaly',
  analyst_revision: 'Analyst Revisions',
  news_sentiment: 'News Sentiment',
  technical_setup: 'Technical Setup',
  vol_adjusted_momentum: 'Risk-Adjusted Momentum',
};

export const FACTOR_DESCRIPTIONS: Record<keyof FactorBreakdown, string> = {
  momentum: "How much this stock has outpaced the S&P 500 recently.",
  volume: 'Whether trading volume is unusually high, a sign of fresh interest.',
  analyst_revision: 'Net analyst upgrades minus downgrades in the last ~10 trading days.',
  news_sentiment: 'Relevance-weighted sentiment of recent news coverage.',
  technical_setup: "Short-term chart setup (e.g. breakout, trend strength).",
  vol_adjusted_momentum: 'Momentum adjusted for how volatile the stock has been.',
};

export interface PerformanceRecord {
  pick_date: string;
  ticker: string;
  price_at_pick: number;
  price_1d: number | null;
  price_5d: number | null;
  price_20d: number | null;
  return_1d: number | null;
  return_5d: number | null;
  return_20d: number | null;
  spy_return_1d: number | null;
  spy_return_5d: number | null;
  spy_return_20d: number | null;
}

export interface WindowSummary {
  sample_size: number;
  avg_return: number;
  avg_spy_return: number;
  win_rate_vs_spy: number;
}

export interface PerformanceSummary {
  '1d': WindowSummary | null;
  '5d': WindowSummary | null;
  '20d': WindowSummary | null;
}
