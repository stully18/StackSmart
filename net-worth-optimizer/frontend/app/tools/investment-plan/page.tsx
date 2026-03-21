'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
    has_emergency_fund: financialData.hasEmergencyFund
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
      const response = await fetch(`${API_BASE_URL}/api/plan/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
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
              type === 'number' ? parseFloat(value) : value
    }));
  };

  // Show loading while checking authentication, or if not authenticated
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-zinc-500 mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back to Tools */}
        <div className="mb-6">
          <Link
            href="/tools"
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors w-fit"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Tools
          </Link>
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 mb-2">
          Personalized Investment Plan
        </h1>
        <p className="text-zinc-500 mb-8">
          Get a customized portfolio based on your financial goals, risk tolerance, and real market data
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Monthly Investment Amount */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Monthly Investment Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-zinc-500">$</span>
                <input
                  type="number"
                  name="monthly_investment_amount"
                  value={formData.monthly_investment_amount}
                  onChange={handleChange}
                  min="1"
                  step="1"
                  className="w-full pl-8 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  required
                />
              </div>
            </div>

            {/* Current Savings */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Current Savings
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-zinc-500">$</span>
                <input
                  type="number"
                  name="current_savings"
                  value={formData.current_savings}
                  onChange={handleChange}
                  min="0"
                  step="1"
                  className="w-full pl-8 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  required
                />
              </div>
            </div>

            {/* Time Horizon */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Time Horizon (Years)
              </label>
              <input
                type="number"
                name="time_horizon_years"
                value={formData.time_horizon_years}
                onChange={handleChange}
                min="1"
                max="50"
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>

            {/* Risk Tolerance */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Risk Tolerance
              </label>
              <select
                name="risk_tolerance"
                value={formData.risk_tolerance}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
              >
                <option value="conservative">Conservative - Stability First</option>
                <option value="moderate">Moderate - Balanced Growth</option>
                <option value="aggressive">Aggressive - Maximum Growth</option>
              </select>
            </div>

            {/* Financial Goal */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Primary Financial Goal
              </label>
              <select
                name="financial_goal"
                value={formData.financial_goal}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
              >
                <option value="wealth_building">Wealth Building - Long-term Growth</option>
                <option value="income_generation">Income Generation - Dividends</option>
                <option value="capital_preservation">Capital Preservation - Protect Assets</option>
                <option value="debt_freedom">Debt Freedom - Build Emergency Fund</option>
              </select>
            </div>

            {/* Emergency Fund */}
            <div className="flex items-center pt-8">
              <input
                type="checkbox"
                name="has_emergency_fund"
                checked={formData.has_emergency_fund}
                onChange={handleChange}
                className="w-5 h-5 bg-zinc-900 border border-zinc-700 rounded text-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <label className="ml-3 text-sm font-medium text-zinc-400">
                I have a 3-6 month emergency fund
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full px-6 py-3 bg-blue-500 rounded-lg font-semibold text-white hover:bg-blue-600 transition-colors disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {loading ? 'Generating Plan...' : 'Generate My Investment Plan'}
          </button>
        </form>

        {/* Error Display */}
        {error && (
          <div className="bg-zinc-900 border-l-4 border-red-500 rounded-lg p-4 mb-8">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {/* Results Display */}
        {plan && (
          <div className="space-y-6">
            {/* Portfolio Overview */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 mb-2">{plan.portfolio_name}</h2>
              <p className="text-zinc-500 mb-4">Risk Profile: {plan.risk_profile}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-4">
                  <div className="text-sm text-zinc-500">Expected Annual Return</div>
                  <div className="text-2xl font-semibold text-green-400">{plan.expected_annual_return}%</div>
                </div>
                <div className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-4">
                  <div className="text-sm text-zinc-500">Portfolio Expense Ratio</div>
                  <div className="text-2xl font-semibold text-blue-400">{plan.portfolio_expense_ratio}%</div>
                </div>
                <div className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-4">
                  <div className="text-sm text-zinc-500">Rebalancing</div>
                  <div className="text-2xl font-semibold text-zinc-200">{plan.rebalancing_frequency}</div>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {plan.warnings && plan.warnings.length > 0 && (
              <div className="bg-zinc-900 border-l-4 border-amber-500 border-t border-r border-b border-t-zinc-800 border-r-zinc-800 border-b-zinc-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-3 text-amber-400">Important Warnings</h3>
                <ul className="space-y-2">
                  {plan.warnings.map((warning, idx) => (
                    <li key={idx} className="text-zinc-300 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">-</span>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ETF Allocations */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold tracking-tight text-zinc-50 mb-4">Your Portfolio Allocation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plan.target_allocation.map((etf) => (
                  <div key={etf.ticker} className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-lg text-zinc-100">{etf.ticker}</h4>
                        <p className="text-sm text-zinc-500">{etf.name}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-green-400">{etf.percentage}%</div>
                        <div className="text-sm text-zinc-500">${etf.monthly_amount}/mo</div>
                      </div>
                    </div>
                    <div className="text-sm text-zinc-400 mb-2">{etf.category}</div>
                    <div className="text-xs text-zinc-500 mb-3">{etf.description}</div>
                    <div className="flex justify-between text-xs">
                      <div>
                        <span className="text-zinc-500">Price: </span>
                        <span className="text-zinc-300">${etf.current_price}</span>
                      </div>
                      {etf.one_year_return !== null && (
                        <div>
                          <span className="text-zinc-500">1-Yr: </span>
                          <span className={etf.one_year_return >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {etf.one_year_return > 0 ? '+' : ''}{etf.one_year_return}%
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-zinc-500">Expense: </span>
                        <span className="text-zinc-300">{etf.expense_ratio}%</span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs">
                      <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-400">
                        Risk: {etf.risk_level}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Projections */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold tracking-tight text-zinc-50 mb-4">Projected Portfolio Value</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4">
                  <div className="text-sm text-zinc-500 mb-1">1 Year</div>
                  <div className="text-2xl font-semibold text-zinc-100">
                    ${plan.projected_value_1yr.toLocaleString()}
                  </div>
                </div>
                <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4">
                  <div className="text-sm text-zinc-500 mb-1">5 Years</div>
                  <div className="text-2xl font-semibold text-zinc-100">
                    ${plan.projected_value_5yr.toLocaleString()}
                  </div>
                </div>
                <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4">
                  <div className="text-sm text-zinc-500 mb-1">10 Years</div>
                  <div className="text-2xl font-semibold text-blue-400">
                    ${plan.projected_value_10yr.toLocaleString()}
                  </div>
                </div>
                <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4">
                  <div className="text-sm text-zinc-500 mb-1">20 Years</div>
                  <div className="text-2xl font-semibold text-blue-400">
                    ${plan.projected_value_20yr.toLocaleString()}
                  </div>
                </div>
                <div className="bg-zinc-800/30 border-2 border-blue-500/30 rounded-xl p-4">
                  <div className="text-sm text-zinc-400 mb-1">30 Years</div>
                  <div className="text-2xl font-semibold text-green-400">
                    ${plan.projected_value_30yr.toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-4">
                * Projections assume consistent monthly contributions and historical average returns. Actual results may vary.
              </p>
            </div>

            {/* Reasoning */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold tracking-tight text-zinc-50 mb-4">Why This Portfolio?</h3>
              <ul className="space-y-3">
                {plan.reasoning.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-blue-500 mt-0.5">+</span>
                    <span className="text-zinc-400">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Next Steps */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold tracking-tight text-zinc-50 mb-4">Next Steps</h3>
              <ol className="space-y-3">
                {plan.next_steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-blue-400 font-semibold">{idx + 1}.</span>
                    <span className="text-zinc-400">{step}</span>
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
