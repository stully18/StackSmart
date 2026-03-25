'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinancialData } from '../../context/FinancialContext';

interface ETFAllocation {
  ticker: string;
  name: string;
  category: string;
  percentage: number;
  monthly_amount: number;
  current_price: number;
  ytd_return: number | null;
  one_year_return: number | null;
  expense_ratio: number;
  description: string;
  risk_level: string;
}

interface PaycheckBreakdown {
  total_monthly_savings: number;
  emergency_fund_monthly: number;
  emergency_fund_target: number;
  emergency_fund_current: number;
  months_to_emergency_fund: number | null;
  contribution_401k: number;
  employer_match_401k: number;
  contribution_roth_ira: number;
  brokerage_investment: number;
}

interface PersonalizedPlanResult {
  portfolio_name: string;
  risk_profile: string;
  target_allocation: ETFAllocation[];
  monthly_investment_breakdown: { [key: string]: number };
  projected_value_1yr: number;
  projected_value_5yr: number;
  projected_value_10yr: number;
  projected_value_20yr: number;
  projected_value_30yr: number;
  expected_annual_return: number;
  portfolio_expense_ratio: number;
  rebalancing_frequency: string;
  reasoning: string[];
  next_steps: string[];
  warnings: string[] | null;
  paycheck_breakdown: PaycheckBreakdown | null;
  months_to_emergency_fund: number | null;
}

export default function InvestmentPlanPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { financialData, updateFinancialData } = useFinancialData();

  // Redirect to login only AFTER auth finishes loading and there's truly no user
  useEffect(() => {
    if (authLoading === false && user === null) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  const [formData, setFormData] = useState({
    monthly_investment_amount: financialData.monthlyBudget,
    risk_tolerance: financialData.riskTolerance,
    financial_goal: financialData.financialGoal,
    time_horizon_years: financialData.timeHorizon,
    current_savings: financialData.currentSavings,
    has_emergency_fund: financialData.hasEmergencyFund,
    // Paycheck allocation fields
    monthly_gross_income: '' as number | '',
    monthly_expenses: '' as number | '',
    employer_401k_match_percent: '' as number | '',
    include_roth_ira: false,
    current_emergency_fund: 0,
    emergency_fund_months_target: 3,
  });

  const [plan, setPlan] = useState<PersonalizedPlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoGenerate, setAutoGenerate] = useState(true);

  // Auto-generate plan on first load if coming from dashboard with data
  useEffect(() => {
    if (autoGenerate && financialData.monthlyBudget > 0) {
      setAutoGenerate(false);
      handleSubmit();
    }
  }, []);

  // Update form when context changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      monthly_investment_amount: financialData.monthlyBudget,
      current_savings: financialData.currentSavings,
      has_emergency_fund: financialData.hasEmergencyFund,
      risk_tolerance: financialData.riskTolerance,
      financial_goal: financialData.financialGoal,
      time_horizon_years: financialData.timeHorizon,
    }));
  }, [financialData]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const grossIncome = formData.monthly_gross_income === '' ? null : formData.monthly_gross_income;
      const expenses = formData.monthly_expenses === '' ? null : Number(formData.monthly_expenses);
      const emergencyFundFull = expenses !== null
        ? formData.current_emergency_fund >= expenses * formData.emergency_fund_months_target
        : formData.has_emergency_fund;
      const payload = {
        ...formData,
        monthly_gross_income: grossIncome,
        monthly_expenses: expenses,
        employer_401k_match_percent: formData.employer_401k_match_percent === '' ? null : formData.employer_401k_match_percent,
        has_emergency_fund: emergencyFundFull,
      };
      const response = await fetch(`${API_BASE_URL}/api/plan/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate plan: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setPlan(data);

      // Sync form data back to context
      updateFinancialData({
        monthlyBudget: formData.monthly_investment_amount,
        currentSavings: formData.current_savings,
        hasEmergencyFund: formData.has_emergency_fund,
        riskTolerance: formData.risk_tolerance as any,
        financialGoal: formData.financial_goal as any,
        timeHorizon: formData.time_horizon_years,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked :
              type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    }));
  };

  // Show loading while checking authentication, or if not authenticated
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-text-muted mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back to Tools */}
        <div className="mb-6">
          <Link
            href="/tools"
            className="flex items-center gap-2 text-text-muted hover:text-text-secondary transition-colors w-fit"
          >
            <ArrowLeft size={20} />
            Back to Tools
          </Link>
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-text-primary mb-2">
          Personalized Investment Plan
        </h1>
        <p className="text-text-muted mb-8">
          Enter your income, expenses, and goals to get a personalized portfolio with a full paycheck allocation plan
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="bg-surface border border-border-subtle rounded-xl p-6 mb-8 space-y-8">

          {/* Section 1: Income & Savings */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Income &amp; Savings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Monthly Take-Home Pay</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-text-muted">$</span>
                  <input
                    type="number"
                    name="monthly_gross_income"
                    value={formData.monthly_gross_income}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    placeholder="e.g. 4000"
                    className="w-full pl-8 pr-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Monthly Living Expenses</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-text-muted">$</span>
                  <input
                    type="number"
                    name="monthly_expenses"
                    value={formData.monthly_expenses}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    placeholder="e.g. 2000"
                    className="w-full pl-8 pr-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Monthly Savings Budget
                  <span className="ml-1 text-text-muted/70 font-normal text-xs">(total to save/invest)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-text-muted">$</span>
                  <input
                    type="number"
                    name="monthly_investment_amount"
                    value={formData.monthly_investment_amount}
                    onChange={handleChange}
                    min="1"
                    step="1"
                    className="w-full pl-8 pr-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border-subtle" />

          {/* Section 2: Emergency Fund & Accounts */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Emergency Fund &amp; Accounts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Current Emergency Fund</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-text-muted">$</span>
                  <input
                    type="number"
                    name="current_emergency_fund"
                    value={formData.current_emergency_fund}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Emergency Fund Target</label>
                <select
                  name="emergency_fund_months_target"
                  value={formData.emergency_fund_months_target}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                >
                  <option value={3}>3 months of expenses</option>
                  <option value={4}>4 months of expenses</option>
                  <option value={5}>5 months of expenses</option>
                  <option value={6}>6 months of expenses</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Employer 401k Match
                  <span className="block text-xs text-text-muted/70 font-normal">% of salary employer matches</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="employer_401k_match_percent"
                    value={formData.employer_401k_match_percent}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.5"
                    placeholder="e.g. 5"
                    className="w-full pl-4 pr-8 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                  <span className="absolute right-3 top-3 text-text-muted">%</span>
                </div>
              </div>
              <div className="flex items-center pt-7">
                <input
                  type="checkbox"
                  name="include_roth_ira"
                  checked={formData.include_roth_ira}
                  onChange={handleChange}
                  className="w-5 h-5 bg-surface-elevated border border-border rounded text-primary focus:ring-2 focus:ring-primary/20"
                />
                <label className="ml-3 text-sm font-medium text-text-secondary">
                  Include Roth IRA
                  <span className="block text-xs text-text-muted/70">Up to $583/mo ($7k/yr)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="border-t border-border-subtle" />

          {/* Section 3: Investment Goals */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Investment Goals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Risk Tolerance</label>
                <select
                  name="risk_tolerance"
                  value={formData.risk_tolerance}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                >
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Primary Goal</label>
                <select
                  name="financial_goal"
                  value={formData.financial_goal}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                >
                  <option value="wealth_building">Wealth Building</option>
                  <option value="income_generation">Income Generation</option>
                  <option value="capital_preservation">Capital Preservation</option>
                  <option value="debt_freedom">Debt Freedom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Time Horizon (Years)</label>
                <input
                  type="number"
                  name="time_horizon_years"
                  value={formData.time_horizon_years}
                  onChange={handleChange}
                  min="1"
                  max="50"
                  className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Current Investment Savings</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-text-muted">$</span>
                  <input
                    type="number"
                    name="current_savings"
                    value={formData.current_savings}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    className="w-full pl-8 pr-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 btn-gradient rounded-lg font-semibold text-white disabled:bg-surface-elevated disabled:text-text-muted disabled:bg-none disabled:cursor-not-allowed"
          >
            {loading ? 'Generating Plan...' : 'Generate My Investment Plan'}
          </button>
        </form>

        {/* Error Display */}
        {error && (
          <div className="bg-surface border-l-4 border-destructive rounded-lg p-4 mb-8">
            <p className="text-destructive">Error: {error}</p>
          </div>
        )}

        {/* Results Display */}
        {plan && (
          <div className="space-y-6">
            {/* Portfolio Overview */}
            <div className="bg-surface border border-border-subtle rounded-xl p-6">
              <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-2">{plan.portfolio_name}</h2>
              <p className="text-text-muted mb-4">Risk Profile: {plan.risk_profile}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-elevated/50 border border-border-subtle rounded-lg p-4">
                  <div className="text-sm text-text-muted">Expected Annual Return</div>
                  <div className="text-2xl font-semibold text-success">{plan.expected_annual_return}%</div>
                </div>
                <div className="bg-surface-elevated/50 border border-border-subtle rounded-lg p-4">
                  <div className="text-sm text-text-muted">Portfolio Expense Ratio</div>
                  <div className="text-2xl font-semibold text-primary">{plan.portfolio_expense_ratio}%</div>
                </div>
                <div className="bg-surface-elevated/50 border border-border-subtle rounded-lg p-4">
                  <div className="text-sm text-text-muted">Rebalancing</div>
                  <div className="text-2xl font-semibold text-text-primary">{plan.rebalancing_frequency}</div>
                </div>
              </div>
            </div>

            {/* Paycheck Allocation Breakdown */}
            {plan.paycheck_breakdown && (
              <div className="bg-surface border border-border-subtle rounded-xl p-6">
                <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-1">Your Paycheck Allocation</h3>
                <p className="text-sm text-text-muted mb-5">
                  How your ${plan.paycheck_breakdown.total_monthly_savings.toLocaleString()}/mo savings budget is divided across accounts
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Emergency Fund */}
                  <div className="bg-surface-elevated/40 border border-warning/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-warning"></div>
                      <span className="text-xs font-semibold text-warning uppercase tracking-wide">Emergency Fund</span>
                    </div>
                    <div className="text-2xl font-semibold text-text-primary mb-1">
                      ${plan.paycheck_breakdown.emergency_fund_monthly.toLocaleString()}<span className="text-sm text-text-muted">/mo</span>
                    </div>
                    {plan.paycheck_breakdown.emergency_fund_monthly > 0 ? (
                      <div className="text-xs text-text-muted">
                        {plan.paycheck_breakdown.months_to_emergency_fund
                          ? `~${plan.paycheck_breakdown.months_to_emergency_fund} months to goal`
                          : 'Building fund'
                        }
                        <div className="mt-1 text-text-muted/70">
                          ${plan.paycheck_breakdown.emergency_fund_current.toLocaleString()} of ${plan.paycheck_breakdown.emergency_fund_target.toLocaleString()} target
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-success">Fund complete</div>
                    )}
                  </div>

                  {/* 401k */}
                  <div className="bg-surface-elevated/40 border border-primary/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide">401k</span>
                    </div>
                    <div className="text-2xl font-semibold text-text-primary mb-1">
                      ${plan.paycheck_breakdown.contribution_401k.toLocaleString()}<span className="text-sm text-text-muted">/mo</span>
                    </div>
                    {plan.paycheck_breakdown.employer_match_401k > 0 && (
                      <div className="text-xs text-text-muted">
                        <span className="text-success">+${plan.paycheck_breakdown.employer_match_401k.toLocaleString()} employer match</span>
                        <div className="text-text-muted/70">= ${(plan.paycheck_breakdown.contribution_401k + plan.paycheck_breakdown.employer_match_401k).toLocaleString()} total/mo</div>
                      </div>
                    )}
                    {plan.paycheck_breakdown.contribution_401k === 0 && (
                      <div className="text-xs text-text-muted/70">No match configured</div>
                    )}
                  </div>

                  {/* Roth IRA */}
                  {plan.paycheck_breakdown.contribution_roth_ira > 0 && (
                    <div className="bg-surface-elevated/40 border border-accent-violet/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-accent-violet"></div>
                        <span className="text-xs font-semibold text-accent-violet uppercase tracking-wide">Roth IRA</span>
                      </div>
                      <div className="text-2xl font-semibold text-text-primary mb-1">
                        ${plan.paycheck_breakdown.contribution_roth_ira.toLocaleString()}<span className="text-sm text-text-muted">/mo</span>
                      </div>
                      <div className="text-xs text-text-muted">Tax-free growth</div>
                      <div className="text-xs text-text-muted/70">${(plan.paycheck_breakdown.contribution_roth_ira * 12).toLocaleString()} of $7,000/yr limit</div>
                    </div>
                  )}

                  {/* Brokerage */}
                  <div className="bg-surface-elevated/40 border border-success/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-success"></div>
                      <span className="text-xs font-semibold text-success uppercase tracking-wide">Brokerage</span>
                    </div>
                    <div className="text-2xl font-semibold text-text-primary mb-1">
                      ${plan.paycheck_breakdown.brokerage_investment.toLocaleString()}<span className="text-sm text-text-muted">/mo</span>
                    </div>
                    <div className="text-xs text-text-muted">ETF portfolio below</div>
                  </div>
                </div>

                <p className="text-xs text-text-muted/70 mt-4">
                  The ETF allocation below is for your brokerage account (${plan.paycheck_breakdown.brokerage_investment.toLocaleString()}/mo). Projections reflect brokerage growth only.
                </p>
              </div>
            )}

            {/* Warnings */}
            {plan.warnings && plan.warnings.length > 0 && (
              <div className="bg-surface border-l-4 border-warning border-t border-r border-b border-t-border-subtle border-r-border-subtle border-b-border-subtle rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-3 text-warning">Important Warnings</h3>
                <ul className="space-y-2">
                  {plan.warnings.map((warning, idx) => (
                    <li key={idx} className="text-text-secondary flex items-start gap-2">
                      <AlertTriangle size={14} className="text-warning mt-0.5" />
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ETF Allocations */}
            <div className="bg-surface border border-border-subtle rounded-xl p-6">
              <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Your Portfolio Allocation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plan.target_allocation.map((etf) => (
                  <div key={etf.ticker} className="bg-surface-elevated/30 border border-border-subtle rounded-xl p-4 hover:border-border transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-lg text-text-primary">{etf.ticker}</h4>
                        <p className="text-sm text-text-muted">{etf.name}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-success">{etf.percentage}%</div>
                        <div className="text-sm text-text-muted">${etf.monthly_amount}/mo</div>
                      </div>
                    </div>
                    <div className="text-sm text-text-secondary mb-2">{etf.category}</div>
                    <div className="text-xs text-text-muted mb-3">{etf.description}</div>
                    <div className="flex justify-between text-xs">
                      <div>
                        <span className="text-text-muted">Price: </span>
                        <span className="text-text-secondary">${etf.current_price}</span>
                      </div>
                      {etf.one_year_return !== null && (
                        <div>
                          <span className="text-text-muted">1-Yr: </span>
                          <span className={etf.one_year_return >= 0 ? 'text-success' : 'text-destructive'}>
                            {etf.one_year_return > 0 ? '+' : ''}{etf.one_year_return}%
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-text-muted">Expense: </span>
                        <span className="text-text-secondary">{etf.expense_ratio}%</span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs">
                      <span className="px-2 py-1 bg-surface-elevated border border-border rounded text-text-secondary">
                        Risk: {etf.risk_level}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Projections */}
            <div className="bg-surface border border-border-subtle rounded-xl p-6">
              <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Projected Portfolio Value</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-surface-elevated/30 border border-border-subtle rounded-xl p-4">
                  <div className="text-sm text-text-muted mb-1">1 Year</div>
                  <div className="text-2xl font-semibold text-text-primary">
                    ${plan.projected_value_1yr.toLocaleString()}
                  </div>
                </div>
                <div className="bg-surface-elevated/30 border border-border-subtle rounded-xl p-4">
                  <div className="text-sm text-text-muted mb-1">5 Years</div>
                  <div className="text-2xl font-semibold text-text-primary">
                    ${plan.projected_value_5yr.toLocaleString()}
                  </div>
                </div>
                <div className="bg-surface-elevated/30 border border-border-subtle rounded-xl p-4">
                  <div className="text-sm text-text-muted mb-1">10 Years</div>
                  <div className="text-2xl font-semibold text-primary">
                    ${plan.projected_value_10yr.toLocaleString()}
                  </div>
                </div>
                <div className="bg-surface-elevated/30 border border-border-subtle rounded-xl p-4">
                  <div className="text-sm text-text-muted mb-1">20 Years</div>
                  <div className="text-2xl font-semibold text-primary">
                    ${plan.projected_value_20yr.toLocaleString()}
                  </div>
                </div>
                <div className="bg-surface-elevated/30 border-2 border-primary/30 rounded-xl p-4">
                  <div className="text-sm text-text-secondary mb-1">30 Years</div>
                  <div className="text-2xl font-semibold text-success">
                    ${plan.projected_value_30yr.toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-xs text-text-muted/70 mt-4">
                * Projections assume consistent monthly contributions and historical average returns. Actual results may vary.
              </p>
            </div>

            {/* Reasoning */}
            <div className="bg-surface border border-border-subtle rounded-xl p-6">
              <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Why This Portfolio?</h3>
              <ul className="space-y-3">
                {plan.reasoning.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check size={14} className="text-primary mt-0.5" />
                    <span className="text-text-secondary">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Next Steps */}
            <div className="bg-surface border border-border-subtle rounded-xl p-6">
              <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Next Steps</h3>
              <ol className="space-y-3">
                {plan.next_steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-primary font-semibold">{idx + 1}.</span>
                    <span className="text-text-secondary">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
