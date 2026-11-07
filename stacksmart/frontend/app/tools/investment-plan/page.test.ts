import { describe, expect, it } from 'vitest';
import { investmentInputs } from '@/lib/investment-inputs';

describe('two-input investment request', () => {
  it('sends only monthly amount and the selected risk', () => {
    expect(investmentInputs('500.25', 'aggressive')).toEqual({ monthly_investment_amount: 500.25, risk_tolerance: 'aggressive' });
  });
  it('requires a risk selection', () => {
    expect(() => investmentInputs('500', '')).toThrow('choose a risk level');
  });
  it('rejects missing, nonfinite, negative, and oversized budgets', () => {
    for (const amount of ['', 'Infinity', 'abc', '-1', '0', '1000000001']) {
      expect(() => investmentInputs(amount, 'moderate')).toThrow();
    }
  });
  it('accepts the low risk savings path and small monthly budgets', () => {
    expect(investmentInputs('0.01', 'conservative')).toEqual({ monthly_investment_amount: 0.01, risk_tolerance: 'conservative' });
  });
});
