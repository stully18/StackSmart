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
      setError('Enter a monthly amount, then choose your risk tolerance and goal.');
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
      setError('You reached your daily AI plan limit. Please come back tomorrow.');
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

        {generationStatus?.used_today && (
          <div className="mt-4 bg-surface border border-warning/50 rounded-lg p-4 text-warning">
            You used all {generationStatus.limit} AI plans today. Come back tomorrow to generate more.
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="bg-surface border border-border-subtle rounded-xl p-6 mb-8 space-y-8 [color-scheme:dark]">

          <div>
            <h2 className="text-xl font-semibold text-text-primary">Start with the essentials</h2>
            <p className="text-sm text-text-secondary mt-1">Three quick choices. Add more detail only if you want to.</p>
          </div>

          <div className="max-w-sm">
            <label htmlFor="monthly-investment" className="block text-sm font-medium text-text-secondary mb-2">How much can you invest each month?</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-text-muted" aria-hidden="true">$</span>
              <input id="monthly-investment" type="number" name="monthly_investment_amount" value={formData.monthly_investment_amount} onChange={handleChange} min="1" step="1" placeholder="e.g. 500" required className="w-full pl-9 pr-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <p className="text-xs text-text-secondary mt-2">Use the amount left after bills and essential expenses.</p>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-text-secondary mb-3">How much risk feels right?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: 'conservative', title: 'Conservative', detail: 'More stability, gentler growth' },
                { value: 'moderate', title: 'Moderate', detail: 'A balance of growth and stability' },
                { value: 'aggressive', title: 'Aggressive', detail: 'More growth potential, bigger swings' },
              ].map(option => (
                <label key={option.value} className="relative cursor-pointer">
                  <input type="radio" name="risk_tolerance" value={option.value} checked={formData.risk_tolerance === option.value} onChange={handleChange} required className="peer sr-only" />
                  <span className="block h-full rounded-xl border border-border bg-surface-elevated/40 p-4 transition-colors hover:border-primary/50 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface">
                    <span className="block font-medium text-text-primary">{option.title}</span>
                    <span className="block text-xs text-text-secondary mt-1">{option.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-text-secondary mb-3">What are you working toward?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { value: 'wealth_building', title: 'Build wealth', detail: 'Grow my money over time' },
                { value: 'income_generation', title: 'Create income', detail: 'Build an income stream' },
                { value: 'capital_preservation', title: 'Protect savings', detail: 'Focus on preserving value' },
                { value: 'debt_freedom', title: 'Get debt-free', detail: 'Balance investing with debt payoff' },
              ].map(option => (
                <label key={option.value} className="relative cursor-pointer">
                  <input type="radio" name="financial_goal" value={option.value} checked={formData.financial_goal === option.value} onChange={handleChange} required className="peer sr-only" />
                  <span className="block h-full rounded-xl border border-border bg-surface-elevated/40 p-4 transition-colors hover:border-primary/50 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface">
                    <span className="block font-medium text-text-primary">{option.title}</span>
                    <span className="block text-xs text-text-secondary mt-1">{option.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <details className="group border-t border-border pt-5">
            <summary className="cursor-pointer text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded">
              Personalize further <span className="text-text-secondary font-normal">(optional)</span>
            </summary>
            <p className="text-sm text-text-secondary mt-3 mb-5">Skip this for a starting plan. Savings default to $0 and projections use a 10-year horizon. Emergency savings are not assumed.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { name: 'current_savings', label: 'Current investment savings ($)', min: 0, max: undefined, placeholder: '0' },
                { name: 'monthly_gross_income', label: 'Monthly income before tax ($)', min: 0, max: undefined, placeholder: 'e.g. 5000' },
                { name: 'monthly_expenses', label: 'Monthly expenses ($)', min: 0, max: undefined, placeholder: 'e.g. 2500' },
                { name: 'current_emergency_fund', label: 'Emergency savings ($)', min: 0, max: undefined, placeholder: '0' },
                { name: 'emergency_fund_months_target', label: 'Emergency fund target (months)', min: 1, max: 12, placeholder: '3' },
                { name: 'age', label: 'Age', min: 13, max: 100, placeholder: 'e.g. 25' },
              ].map(field => (
                <div key={field.name}>
                  <label htmlFor={field.name} className="block text-sm font-medium text-text-secondary mb-2">{field.label}</label>
                  <input id={field.name} type="number" name={field.name} value={formData[field.name as keyof InvestmentPlanFormData] as number | ''} onChange={handleChange} min={field.min} max={field.max} step="1" placeholder={field.placeholder} className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary/20" />
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 my-5">
              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input type="checkbox" name="has_emergency_fund" checked={formData.has_emergency_fund} onChange={handleChange} className="w-5 h-5 accent-primary" />
                I have 3 to 6 months of emergency savings
              </label>
              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input type="checkbox" name="include_roth_ira" checked={formData.include_roth_ira} onChange={handleChange} className="w-5 h-5 accent-primary" />
                Include a Roth IRA in my plan
              </label>
            </div>
            <label htmlFor="planning-notes" className="block text-sm font-medium text-text-secondary mb-2">Anything else to consider?</label>
            <textarea id="planning-notes" name="notes" value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} maxLength={1000} placeholder="Any future goals or anything the AI Advisor should know?" className="w-full px-4 py-3 bg-surface-elevated/60 border border-border rounded-lg text-text-primary placeholder-text-muted min-h-24 focus:border-primary focus:ring-1 focus:ring-primary/20" />
          </details>
          <p className="text-xs text-text-secondary">{loans.length} saved loan{loans.length === 1 ? '' : 's'} included from Debt Optimizer.</p>

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

                  {/* Plan Assumptions */}
                  {plan.advisor_assumptions && (() => {
                    const a = plan.advisor_assumptions!;
                    return (
                      <div className="bg-surface border border-border-subtle rounded-xl p-6">
                        <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">
                          Plan Assumptions
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
                              Caveats
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
