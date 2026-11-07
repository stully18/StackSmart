export interface HoldingInput {
  ticker: string;
  current_value: number | '';
}

export interface LiquidityNeedInput {
  amount: number | '';
  months_until_needed: number | '';
  purpose: string;
}

export function planningContext(
  holdings: HoldingInput[],
  needs: LiquidityNeedInput[]
) {
  if (holdings.length > 20 || needs.length > 10) {
    throw new Error('Use up to 20 holdings and 10 upcoming expenses.');
  }
  const seen = new Set<string>();
  const existing_holdings = holdings.map(holding => {
    const ticker = holding.ticker.trim().toUpperCase();
    const value = Number(holding.current_value);
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker) || holding.current_value === '' || !Number.isFinite(value) || value < 0) {
      throw new Error('Enter a valid ticker and a nonnegative current value for each holding, or remove the row.');
    }
    if (seen.has(ticker)) throw new Error('Combine duplicate tickers into one holding.');
    seen.add(ticker);
    return { ticker, current_value: value };
  });
  const liquidity_needs = needs.map(need => {
    const amount = Number(need.amount);
    const months = Number(need.months_until_needed);
    if (need.amount === '' || !Number.isFinite(amount) || amount <= 0 || need.months_until_needed === '' || !Number.isInteger(months) || months < 0 || months > 600 || !need.purpose.trim() || need.purpose.trim().length > 160) {
      throw new Error('Give each upcoming expense a positive amount, a timeframe of 0–600 whole months, and a short purpose, or remove the row.');
    }
    return { amount, months_until_needed: months, purpose: need.purpose.trim() };
  });
  return { existing_holdings, liquidity_needs };
}
