import { describe, expect, it } from 'vitest';
import { planningContext } from './planning-inputs';

describe('planningContext', () => {
  it('normalizes tickers and keeps holdings separate from upcoming needs', () => {
    expect(planningContext(
      [{ ticker: ' vti ', current_value: 1200 }],
      [{ amount: 5000, months_until_needed: 6, purpose: ' Tuition ' }]
    )).toEqual({
      existing_holdings: [{ ticker: 'VTI', current_value: 1200 }],
      liquidity_needs: [{ amount: 5000, months_until_needed: 6, purpose: 'Tuition' }],
    });
  });

  it('rejects duplicate or unsafe tickers and nonfinite or omitted values', () => {
    for (const holdings of [
      [{ ticker: 'VTI', current_value: Infinity }],
      [{ ticker: 'VTI', current_value: '' as const }],
      [{ ticker: '<script>', current_value: 1 }],
      [{ ticker: 'VTI', current_value: 1 }, { ticker: 'vti', current_value: 2 }],
    ]) expect(() => planningContext(holdings, [])).toThrow();
  });

  it('requires valid liquidity context and accepts an immediate need', () => {
    expect(planningContext([], [{ amount: 10, months_until_needed: 0, purpose: 'Bills' }]).liquidity_needs[0].months_until_needed).toBe(0);
    for (const need of [
      { amount: 10, months_until_needed: 1.5, purpose: 'Bills' },
      { amount: 10, months_until_needed: 601, purpose: 'Bills' },
      { amount: NaN, months_until_needed: 2, purpose: 'Bills' },
      { amount: 10, months_until_needed: 2, purpose: '' },
    ]) expect(() => planningContext([], [need])).toThrow();
  });
});
