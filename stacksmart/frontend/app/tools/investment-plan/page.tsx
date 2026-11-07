'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { generatePersonalizedPlan } from '@/lib/api';
import { investmentInputs, type InvestmentRisk as Risk } from '@/lib/investment-inputs';
import type { SatelliteStockIdea } from '@/types';

interface InvestmentOptions {
  advisor_summary?: string | null;
  reasoning: string[];
  target_allocation: { ticker: string; name: string; percentage: number; monthly_amount: number; description: string }[];
  savings_recommendation?: { name: string; monthly_amount: number; reason: string; risk_note: string } | null;
  satellite_stock_ideas: SatelliteStockIdea[];
  plan_source: string;
}

const riskChoices: { value: Risk; label: string; description: string }[] = [
  { value: 'conservative', label: 'Low risk', description: 'Keep it stable with savings.' },
  { value: 'moderate', label: 'Balanced', description: 'A diversified mix of ETFs.' },
  { value: 'aggressive', label: 'Higher risk', description: 'More stock exposure and bigger swings.' },
];
const usd = (amount: number) => amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default function InvestmentPlanPage() {
  const router = useRouter();
  const { user, session, isLoading: authLoading } = useAuth();
  const [amount, setAmount] = useState('');
  const [risk, setRisk] = useState<Risk | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<InvestmentOptions | null>(null);
  const [generatedRisk, setGeneratedRisk] = useState<Risk | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [authLoading, user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!session?.access_token) {
      setError('Please sign in again to generate your options.');
      return;
    }
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const result = await generatePersonalizedPlan(investmentInputs(amount, risk), session.access_token);
      setPlan(result);
      setGeneratedRisk(risk || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate options. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !user) {
    return <main className="min-h-screen flex items-center justify-center"><p role="status" className="text-text-secondary">Loading...</p></main>;
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-28 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-primary">
          <ArrowLeft size={16} /> Back to Tools
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">Find your investment options</h1>
        <p className="mt-3 text-text-secondary">Choose a monthly amount and a risk level.</p>

        <form onSubmit={handleSubmit} className="mt-8 rounded-2xl border border-white/10 bg-surface p-5 sm:p-8">
          <label htmlFor="monthly-amount" className="block font-medium text-text-primary">How much can you invest each month?</label>
          <div className="relative mt-3 max-w-sm">
            <span aria-hidden="true" className="absolute left-4 top-3 text-text-secondary">$</span>
            <input id="monthly-amount" type="number" min="0.01" max="1000000000" step="0.01" required value={amount}
              onChange={event => { setAmount(event.target.value); setPlan(null); }} placeholder="e.g. 500" disabled={loading}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-4 text-lg text-text-primary outline-none focus:border-primary disabled:opacity-60" />
          </div>
          <p className="mt-2 text-sm text-text-secondary">Use money left after bills and essentials.</p>

          <fieldset className="mt-7" disabled={loading}>
            <legend className="font-medium text-text-primary">How much risk feels right?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {riskChoices.map(choice => (
                <label key={choice.value} className={`relative cursor-pointer rounded-xl border p-4 transition-colors ${risk === choice.value ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/30'}`}>
                  <input type="radio" name="risk" value={choice.value} required checked={risk === choice.value}
                    onChange={() => { setRisk(choice.value); setPlan(null); }} className="peer sr-only" />
                  <span aria-hidden="true" style={{ pointerEvents: 'none' }} className="absolute inset-0 rounded-xl peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
                  <span className="block font-semibold text-text-primary">{choice.label}</span>
                  <span className="mt-1 block text-sm text-text-secondary">{choice.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" className="mt-5 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={loading} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-black disabled:opacity-60">
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? 'Finding your options...' : 'Generate investment options'}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-text-secondary">Demo inputs only. This free AI provider must not receive personal or confidential data.</p>
        </form>

        {plan && (
          <section aria-label="Your investment options" aria-live="polite" className="mt-9">
            <h2 className="text-2xl font-semibold text-text-primary">Your options</h2>
            <p className="mt-2 text-text-secondary">{plan.advisor_summary}</p>
            <div className="mt-5 grid gap-4">
              {plan.savings_recommendation && (
                <article className="rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-text-primary">{plan.savings_recommendation.name}</h3>
                    <p className="font-semibold text-primary">{usd(plan.savings_recommendation.monthly_amount)} / month</p>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary">{plan.savings_recommendation.reason}</p>
                  <p className="mt-3 text-sm text-text-secondary">{plan.savings_recommendation.risk_note}</p>
                </article>
              )}
              {plan.target_allocation.map(option => (
                <article key={option.ticker} className="rounded-2xl border border-white/10 bg-surface p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="text-lg font-semibold text-text-primary">{option.ticker}</h3><p className="mt-1 text-sm text-text-secondary">{option.name}</p></div>
                    <div className="text-right"><p className="font-semibold text-primary">{usd(option.monthly_amount)} / month</p><p className="mt-1 text-sm text-text-secondary">{option.percentage}% of your ETF mix</p></div>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary">{plan.reasoning.find(reason => reason.startsWith(`${option.ticker}: `))?.slice(option.ticker.length + 2) || option.description}</p>
                </article>
              ))}
              {generatedRisk === 'aggressive' && plan.satellite_stock_ideas.slice(0, 1).map(idea => (
                <article key={idea.ticker} className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-300">Stock to research - separate from your monthly mix</p>
                  <h3 className="mt-2 text-lg font-semibold text-text-primary">{idea.ticker} - {idea.name}</h3>
                  <p className="mt-3 text-sm text-text-secondary">{idea.reason}</p>
                  <p className="mt-2 text-sm text-text-secondary">{idea.risk_note}</p>
                  <p className="mt-3 text-xs text-text-secondary">Screen dated {idea.as_of}. No money is allocated to this idea.</p>
                </article>
              ))}
            </div>
            {generatedRisk === 'aggressive' && plan.satellite_stock_ideas.length === 0 && <p className="mt-3 text-sm text-text-secondary">No current verified stock idea is available, so your options use ETFs.</p>}
            {plan.plan_source === 'rule_based' && !plan.savings_recommendation && <p className="mt-3 text-sm text-text-secondary">Showing a rule-based ETF mix; AI generation is currently disabled.</p>}
            <p className="mt-5 text-xs leading-relaxed text-text-secondary">Educational examples, not a complete financial plan. ETFs and stocks can lose value. Keep money you need soon in savings.</p>
          </section>
        )}
      </div>
    </main>
  );
}
