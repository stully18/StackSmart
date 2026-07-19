import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('InvestmentPlanPage auto-generation behavior', () => {
  const source = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');

  it('does not auto-generate a plan when the page mounts', () => {
    expect(source).not.toContain('autoGenerate');
    expect(source).not.toContain('Auto-generate plan on first load');

    const mountEffects = Array.from(
      source.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n\s*\}, \[[^\]]*\]\);/g),
      match => match[1]
    );

    expect(mountEffects.some(effectBody => effectBody.includes('handleSubmit('))).toBe(false);
    expect(mountEffects.some(effectBody => effectBody.includes('/api/plan/generate'))).toBe(false);
  });

  it('starts with a clear form instead of financial context defaults', () => {
    expect(source).toContain("monthly_investment_amount: ''");
    expect(source).toContain("current_savings: ''");
    expect(source).toContain("risk_tolerance: ''");
    expect(source).toContain("financial_goal: ''");
    expect(source).toContain('has_emergency_fund: false');
    expect(source).toContain('Select risk tolerance');
    expect(source).toContain('Select primary goal');

    expect(source).not.toContain('monthly_investment_amount: financialData.monthlyBudget');
    expect(source).not.toContain('current_savings: financialData.currentSavings');
    expect(source).not.toContain('risk_tolerance: financialData.riskTolerance');
    expect(source).not.toContain('financial_goal: financialData.financialGoal');
    expect(source).not.toContain('...prev,\n      monthly_investment_amount: financialData.monthlyBudget');
  });

  it('sends authenticated ai planning inputs and shows daily limit copy', () => {
    expect(source).toContain('fetchPlanGenerationStatus');
    expect(source).toContain('generatePersonalizedPlan');
    expect(source).toContain('session?.access_token');
    expect(source).toContain('loans.map');
    expect(source).toContain('generations per day');
    expect(source).toContain('Daily AI Limit Reached');
  });

  it('renders the AI advisor dashboard above the ETF allocation sections', () => {
    // Top-level advisor dashboard header.
    expect(source).toContain('Your AI Advisor Plan');
    // Fallback banner copy when plan_source === 'rule_based'.
    expect(source).toContain("plan.plan_source === 'rule_based'");
    expect(source).toContain('Rule-based fallback');
    // Advisor cards, sorted/sliced 6-8.
    expect(source).toContain('prioritizedAdvisorCards');
    expect(source).toContain('advisor_cards');
    // Conditional sections.
    expect(source).toContain('Monthly Action Plan');
    expect(source).toContain('ETF Investing');
    expect(source).toContain('Extra Debt Payoff');
    expect(source).toContain('Emergency Fund');
    expect(source).toContain('Optional Satellite Stock Ideas');
    expect(source).toContain('Keep diversified ETFs as the core');
    expect(source).toContain('Plan Confidence &amp; Assumptions');
    expect(source).toContain('Data Used');
    expect(source).toContain('Missing Data');
    expect(source).toContain('Caveats');
  });

  it('uses the renamed ETF + reasoning headings', () => {
    expect(source).toContain('Core ETF Allocation Details');
    expect(source).toContain('investable core behind the advisor recommendations');
    expect(source).toContain('Why This Advisor Plan?');
    expect(source).not.toContain('Why This Portfolio?');
    expect(source).not.toContain('Your Portfolio Allocation');
  });
});
