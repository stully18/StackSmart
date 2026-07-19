'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BrokerageLinks from '@/app/components/BrokerageLinks';
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinancialData } from '../../context/FinancialContext';
import BetaNotice from '@/app/components/BetaNotice';
import FeedbackPanel from '@/app/components/FeedbackPanel';
import { fetchPlanGenerationStatus, generatePersonalizedPlan } from '@/lib/api';
import { loadUserLoans, logAppEvent } from '@/lib/loans';
import type {
  Loan,
  PersonalizedPlanGenerationStatus,
  AdvisorCard,
  MonthlyActionPlan,
  SatelliteStockIdea,
  AdvisorAssumptions,
  PlanSource,
} from '@/types';

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
  months_to_emergency_fund: number | null;
  advisor_summary?: string | null;
  advisor_cards?: AdvisorCard[];
  monthly_action_plan?: MonthlyActionPlan | null;
  satellite_stock_ideas?: SatelliteStockIdea[];
  advisor_assumptions?: AdvisorAssumptions | null;
  plan_source?: PlanSource;
}

interface InvestmentPlanFormData {
  monthly_investment_amount: number | '';
  risk_tolerance: '' | 'conservative' | 'moderate' | 'aggressive';
  financial_goal: '' | 'wealth_building' | 'income_generation' | 'capital_preservation' | 'debt_freedom';
  current_savings: number | '';
  has_emergency_fund: boolean;
  include_roth_ira: boolean;
  monthly_gross_income: number | '';
  monthly_expenses: number | '';
  current_emergency_fund: number | '';
  emergency_fund_months_target: number | '';
  age: number | '';
  notes: string;
}

const emptyFormData: InvestmentPlanFormData = {
  monthly_investment_amount: '',
  risk_tolerance: '',
  financial_goal: '',
  current_savings: '',
  has_emergency_fund: false,
  include_roth_ira: false,
  monthly_gross_income: '',
  monthly_expenses: '',
  current_emergency_fund: '',
  emergency_fund_months_target: 3,
  age: '',
  notes: '',
};

// Sort advisor cards by priority ascending and keep 6-8 for the dashboard.
function prioritizedAdvisorCards(cards: AdvisorCard[] | undefined): AdvisorCard[] {
  if (!cards || cards.length === 0) return [];
  const sorted = [...cards].sort((a, b) => a.priority - b.priority);
  // Show a denser 6-8 card dashboard when more are available.
  return sorted.length > 8 ? sorted.slice(0, 8) : sorted;
}

function formatUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function InvestmentPlanPage() {
  const router = useRouter();
  const { user, session, isLoading: authLoading } = useAuth();
  const { updateFinancialData } = useFinancialData();

  // Redirect to login only AFTER auth finishes loading and there's truly no user
  useEffect(() => {
    if (authLoading === false && user === null) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !session?.access_token) return;

    let isMounted = true;

    const loadAiInputs = async () => {
      setStatusLoading(true);
      try {
        const [savedLoans, status] = await Promise.all([
          loadUserLoans(),
          fetchPlanGenerationStatus(session.access_token),
        ]);
        if (isMounted) {
          setLoans(savedLoans);
          setGenerationStatus(status);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load AI planning inputs.');
        }
      } finally {
        if (isMounted) setStatusLoading(false);
      }
    };

    loadAiInputs();

    return () => {
      isMounted = false;
    };
  }, [user, session?.access_token]);

  const [formData, setFormData] = useState<InvestmentPlanFormData>(emptyFormData);

  const [plan, setPlan] = useState<PersonalizedPlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [generationStatus, setGenerationStatus] = useState<PersonalizedPlanGenerationStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const monthlyInvestmentAmount = Number(formData.monthly_investment_amount);
    const currentSavings = Number(formData.current_savings);
    if (
      !monthlyInvestmentAmount ||
      currentSavings < 0 ||
      !formData.risk_tolerance ||
      !formData.financial_goal
    ) {
      setError('Please complete the investment amount, savings, risk tolerance, and goal before generating a plan.');
      return;
    }

    setLoading(true);
    setError(null);

    if (!session?.access_token) {
      setError('Please sign in again before generating an AI plan.');
      setLoading(false);
      return;
    }

    if (generationStatus?.used_today) {
      setError('You already generated your AI plan today. Please come back tomorrow.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        monthly_investment_amount: monthlyInvestmentAmount,
        current_savings: currentSavings,
        time_horizon_years: 10,
        monthly_gross_income: formData.monthly_gross_income === '' ? null : Number(formData.monthly_gross_income),
        monthly_expenses: formData.monthly_expenses === '' ? null : Number(formData.monthly_expenses),
        current_emergency_fund: formData.current_emergency_fund === '' ? 0 : Number(formData.current_emergency_fund),
        emergency_fund_months_target: formData.emergency_fund_months_target === '' ? 3 : Number(formData.emergency_fund_months_target),
        age: formData.age === '' ? null : Number(formData.age),
        notes: formData.notes.trim() || null,
        loans: loans.map(({ id, ...loan }) => ({
          ...loan,
          interest_rate: loan.interest_rate / 100,
        })),
      };
      const data = await generatePersonalizedPlan(payload, session.access_token);

      setPlan(data);
      setGenerationStatus({
        limit: generationStatus?.limit ?? 10,
        used_count: Math.min((generationStatus?.used_count ?? 0) + 1, generationStatus?.limit ?? 10),
        remaining: Math.max((generationStatus?.remaining ?? 10) - 1, 0),
        used_today: ((generationStatus?.used_count ?? 0) + 1) >= (generationStatus?.limit ?? 10),
        generation: null,
      });

      // Best-effort event log; never block on it or surface its failure.
      try {
        await logAppEvent('report_generated', { source: 'investment_plan', risk_tolerance: formData.risk_tolerance });
      } catch (eventErr) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[InvestmentPlan] report_generated event logging failed:', eventErr);
        }
      }

      // Sync form data back to context
      updateFinancialData({
        monthlyBudget: monthlyInvestmentAmount,
        currentSavings,
        hasEmergencyFund: formData.has_emergency_fund,
        riskTolerance: formData.risk_tolerance,
        financialGoal: formData.financial_goal,
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
    <div className="min-h-screen bg-background text-white px-4 py-6 sm:px-6 sm:py-8">
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

        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-primary mb-2">
          Personalized Investment Plan
        </h1>
        <p className="text-text-muted mb-8">
          Enter how much you have available to invest each month and your goals to get a personalized ETF portfolio
        </p>

        <div className="mb-8">
          <BetaNotice
            title="Portfolio planning estimate"
            message="This tool uses simplified assumptions and broad ETF examples. Confirm fund choices, tax treatment, and account type before placing trades."
          />
        </div>

        <p className="text-sm text-text-muted mt-3">
          AI plans are limited to {generationStatus?.limit ?? 10} generations per day per account. StackSmart includes your saved loans and the factors below, then asks Gemini Flash for a structured educational plan.
        </p>
        {generationStatus?.used_today && (
          <div className="mt-4 bg-surface border border-warning/50 rounded-lg p-4 text-warning">
            You used all {generationStatus.limit} AI plans today. Come back tomorrow to generate more.
          </div>
        )}
        {generationStatus && !generationStatus.used_today && (
          <p className="text-xs text-text-muted mt-3">
            {generationStatus.remaining ?? Math.max(generationStatus.limit - (generationStatus.used_count ?? 0), 0)} AI plan generations remaining today.
          </p>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="bg-surface border border-border-subtle rounded-xl p-6 mb-8 space-y-8">

          {/* Section 1: Investment Amount */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Investment Amount</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Monthly Amount to Invest
                  <span className="block text-xs text-text-muted/70 font-normal">After bills, expenses &amp; emergency fund</span>
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
                    placeholder="e.g. 500"
                    className="w-full pl-8 pr-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>
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
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center pt-7">
                <input
                  type="checkbox"
                  name="has_emergency_fund"
                  checked={formData.has_emergency_fund}
                  onChange={handleChange}
                  className="w-5 h-5 bg-surface-elevated border border-border rounded text-primary focus:ring-2 focus:ring-primary/20"
                />
                <label className="ml-3 text-sm font-medium text-text-secondary">
                  I have an emergency fund
                  <span className="block text-xs text-text-muted/70">3–6 months of expenses saved</span>
                </label>
              </div>
            </div>
          </div>

          <div className="border-t border-border-subtle" />

          {/* Section 2: Goals & Preferences */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Goals &amp; Preferences</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Risk Tolerance</label>
                <select
                  name="risk_tolerance"
                  value={formData.risk_tolerance}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  required
                >
                  <option value="" disabled>Select risk tolerance</option>
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
                  required
                >
                  <option value="" disabled>Select primary goal</option>
                  <option value="wealth_building">Wealth Building</option>
                  <option value="income_generation">Income Generation</option>
                  <option value="capital_preservation">Capital Preservation</option>
                  <option value="debt_freedom">Debt Freedom</option>
                </select>
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
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Optional AI Context</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <input type="number" name="monthly_gross_income" value={formData.monthly_gross_income} onChange={handleChange} min="0" step="1" placeholder="Monthly gross income" className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70" />
              <input type="number" name="monthly_expenses" value={formData.monthly_expenses} onChange={handleChange} min="0" step="1" placeholder="Monthly expenses" className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70" />
              <input type="number" name="current_emergency_fund" value={formData.current_emergency_fund} onChange={handleChange} min="0" step="1" placeholder="Emergency fund saved" className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70" />
              <input type="number" name="emergency_fund_months_target" value={formData.emergency_fund_months_target} onChange={handleChange} min="1" max="12" step="1" placeholder="Emergency fund months target" className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70" />
              <input type="number" name="age" value={formData.age} onChange={handleChange} min="13" max="100" step="1" placeholder="Age" className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70" />
              <div className="md:col-span-3">
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  maxLength={1000}
                  placeholder="Anything else Gemini should consider? Example: buying a home, variable income, upcoming tuition."
                  className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted/70 min-h-24"
                />
              </div>
            </div>
            <p className="text-xs text-text-muted/70 mt-3">
              Saved loans loaded: {loans.length}. Update loans in Debt Optimizer before generating if this looks wrong.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || statusLoading || generationStatus?.used_today}
            className="w-full px-6 py-3 btn-gradient rounded-lg font-semibold text-gray-900 disabled:bg-surface-elevated disabled:text-text-muted disabled:bg-none disabled:cursor-not-allowed"
          >
            {loading ? 'Generating AI Plan...' : generationStatus?.used_today ? 'Daily AI Limit Reached' : 'Generate My AI Plan'}
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
            {/* AI Advisor Dashboard (top-level, before ETF allocation) */}
            {(() => {
              const cards = prioritizedAdvisorCards(plan.advisor_cards);
              const isRuleBased = plan.plan_source === 'rule_based';
              const showDashboard = Boolean(plan.advisor_summary || cards.length > 0);
              if (!showDashboard) return null;

              const confidenceTone: Record<string, string> = {
                high: 'text-success border-success/40',
                medium: 'text-primary border-primary/40',
                low: 'text-warning border-warning/40',
              };

              return (
                <div className="space-y-6">
                  {isRuleBased && (
                    <div className="bg-surface border-l-4 border-warning border-t border-r border-b border-t-border-subtle border-r-border-subtle border-b-border-subtle rounded-lg p-4">
                      <h3 className="text-base font-semibold mb-1 text-warning">Rule-based fallback</h3>
                      <p className="text-sm text-text-secondary">
                        AI plan generation is unavailable, so StackSmart built this advisor dashboard from your
                        inputs using a deterministic rule-based fallback. It is educational guidance, not professional advice.
                      </p>
                    </div>
                  )}

                  <div className="bg-surface border border-primary/30 rounded-xl p-6">
                    <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-2">Your AI Advisor Plan</h2>
                    {plan.advisor_summary && (
                      <p className="text-text-muted mb-4">{plan.advisor_summary}</p>
                    )}

                    {cards.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cards.map((card) => (
                          <div
                            key={`${card.category}-${card.priority}`}
                            className="bg-surface-elevated/30 border border-border-subtle rounded-xl p-4 hover:border-border transition-colors"
                          >
                            <div className="flex justify-between items-start gap-3 mb-2">
                              <div>
                                <h4 className="font-semibold text-lg text-text-primary">{card.title}</h4>
                                <p className="text-xs uppercase tracking-widest text-text-muted">{card.category.replace('_', ' ')}</p>
                              </div>
                              {card.confidence && (
                                <span className={`text-xs px-2 py-1 rounded border ${confidenceTone[card.confidence] ?? 'text-text-secondary border-border'}`}>
                                  {card.confidence} confidence
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-text-secondary mb-2">{card.recommendation}</p>
                            <p className="text-xs text-text-muted mb-3">{card.rationale}</p>
                            {card.action_items && card.action_items.length > 0 && (
                              <ul className="space-y-1 mb-3">
                                {card.action_items.map((item, idx) => (
                                  <li key={idx} className="text-sm text-text-secondary flex items-start gap-2">
                                    <Check size={14} className="text-primary mt-0.5" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {card.monthly_amount !== null && card.monthly_amount !== undefined && (
                              <div className="text-sm">
                                <span className="text-text-muted">Monthly: </span>
                                <span className="text-success font-semibold">{formatUsd(card.monthly_amount)}/mo</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Monthly Action Plan */}
                  {plan.monthly_action_plan && (() => {
                    const map = plan.monthly_action_plan;
                    return (
                      <div className="bg-surface border border-border-subtle rounded-xl p-6">
                        <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Monthly Action Plan</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-surface-elevated/30 border border-border-subtle rounded-lg p-4">
                            <div className="text-sm text-text-muted">Available Monthly</div>
                            <div className="text-2xl font-semibold text-text-primary">{formatUsd(map.available_monthly_amount)}</div>
                          </div>
                          <div className="bg-surface-elevated/30 border border-border-subtle rounded-lg p-4">
                            <div className="text-sm text-text-muted">ETF Investing</div>
                            <div className="text-2xl font-semibold text-success">{formatUsd(map.etf_investing_amount)}</div>
                          </div>
                          <div className="bg-surface-elevated/30 border border-border-subtle rounded-lg p-4">
                            <div className="text-sm text-text-muted">Extra Debt Payoff</div>
                            <div className="text-2xl font-semibold text-primary">{formatUsd(map.debt_extra_payment_amount)}</div>
                          </div>
                          <div className="bg-surface-elevated/30 border border-border-subtle rounded-lg p-4">
                            <div className="text-sm text-text-muted">Emergency Fund</div>
                            <div className="text-2xl font-semibold text-text-primary">{formatUsd(map.emergency_fund_amount)}</div>
                          </div>
                        </div>
                        {map.notes && map.notes.length > 0 && (
                          <ul className="mt-4 space-y-1">
                            {map.notes.map((note, idx) => (
                              <li key={idx} className="text-xs text-text-muted flex items-start gap-2">
                                <AlertTriangle size={12} className="text-warning mt-0.5" />
                                {note}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })()}

                  {/* Optional Satellite Stock Ideas */}
                  {plan.satellite_stock_ideas && plan.satellite_stock_ideas.length > 0 && (
                    <div className="bg-surface border border-border-subtle rounded-xl p-6">
                      <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-1">Optional Satellite Stock Ideas</h3>
                      <p className="text-sm text-text-muted mb-4">
                        Keep diversified ETFs as the core. These individual stocks are small, optional satellite picks only.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {plan.satellite_stock_ideas.map((idea) => (
                          <div
                            key={idea.ticker}
                            className="bg-surface-elevated/30 border border-warning/30 rounded-xl p-4"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold text-lg text-text-primary">{idea.ticker}</h4>
                                <p className="text-sm text-text-muted">{idea.name}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-semibold text-text-primary">{idea.allocation_percent}%</div>
                                <div className="text-sm text-text-muted">{formatUsd(idea.monthly_amount)}/mo</div>
                              </div>
                            </div>
                            <p className="text-sm text-text-secondary mb-2">{idea.reason}</p>
                            <p className="text-xs text-warning">Risk: {idea.risk_note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Plan Confidence & Assumptions */}
                  {plan.advisor_assumptions && (() => {
                    const a = plan.advisor_assumptions!;
                    return (
                      <div className="bg-surface border border-border-subtle rounded-xl p-6">
                        <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">
                          Plan Confidence &amp; Assumptions
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-surface-elevated/30 border border-border-subtle rounded-lg p-4">
                            <div className="text-sm text-text-muted mb-2">Data Used</div>
                            {a.data_used.length > 0 ? (
                              <ul className="space-y-1">
                                {a.data_used.map((item, idx) => (
                                  <li key={idx} className="text-sm text-text-secondary flex items-start gap-2">
                                    <Check size={14} className="text-success mt-0.5" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-text-muted">No supplementary data provided.</p>
                            )}
                          </div>
                          <div className="bg-surface-elevated/30 border border-border-subtle rounded-lg p-4">
                            <div className="text-sm text-text-muted mb-2">Missing Data</div>
                            {a.missing_data.length > 0 ? (
                              <ul className="space-y-1">
                                {a.missing_data.map((item, idx) => (
                                  <li key={idx} className="text-sm text-text-secondary flex items-start gap-2">
                                    <AlertTriangle size={14} className="text-warning mt-0.5" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-text-muted">No notable gaps.</p>
                            )}
                          </div>
                          <div className="bg-surface-elevated/30 border border-border-subtle rounded-lg p-4">
                            <div className="text-sm text-text-muted mb-2">
                              Caveats {a.confidence && <span className="text-text-secondary">({a.confidence} confidence)</span>}
                            </div>
                            {a.caveats.length > 0 ? (
                              <ul className="space-y-1">
                                {a.caveats.map((item, idx) => (
                                  <li key={idx} className="text-sm text-text-secondary flex items-start gap-2">
                                    <AlertTriangle size={14} className="text-warning mt-0.5" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-text-muted">No caveats noted.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

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
              <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-1">Core ETF Allocation Details</h3>
              <p className="text-sm text-text-muted mb-4">
                This is the investable core behind the advisor recommendations above.
              </p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
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
              <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Why This Advisor Plan?</h3>
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

            <BrokerageLinks />

            <FeedbackPanel source="Investment Plan" />
          </div>
        )}
      </div>
    </div>
  );
}
