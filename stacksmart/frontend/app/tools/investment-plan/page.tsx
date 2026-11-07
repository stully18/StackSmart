'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { generatePersonalizedPlan } from '@/lib/api';
import { investmentInputs, type InvestmentRisk as Risk } from '@/lib/investment-inputs';
import type { SatelliteStockIdea } from '@/types';

interface ProjectionPoint { months: number; balance: number; contributions: number; growth: number }
interface Projection {
  annual_rate_percent: number;
  monthly_amount: number;
  milestones: ProjectionPoint[];
  series?: ProjectionPoint[];
  goal_amount: number | null;
  goal_months: number | null;
  goal_point: ProjectionPoint | null;
  shortfall: number | null;
  required_monthly_amount: number | null;
  months_to_goal: number | null;
  parsing_note: string | null;
  maximum_months: number;
  assumptions: string;
}
interface InvestmentOptions {
  projection?: Projection | null;
  advisor_summary?: string | null;
  reasoning: string[];
  warnings?: string[];
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
  const [goal, setGoal] = useState('');
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
      const result = await generatePersonalizedPlan(investmentInputs(amount, risk, goal), session.access_token);
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
          <div className="mt-7">
            <label htmlFor="investment-goal" className="block font-medium text-text-primary">What are you saving for? <span className="font-normal text-text-secondary">(optional)</span></label>
            <textarea id="investment-goal" value={goal} maxLength={500} disabled={loading} rows={2}
              onChange={event => { setGoal(event.target.value); setPlan(null); }}
              placeholder="For example: $30,000 for a house down payment in 5 years."
              className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-text-primary outline-none focus:border-primary disabled:opacity-60" />
            <p className="mt-2 text-xs text-text-secondary">Include an amount and timeframe for a goal estimate. Use demo details only.</p>
          </div>
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
            <p className="mt-2 text-xs text-text-secondary">{plan.plan_source === 'ai' ? 'ETF options personalized with AI. Projection math calculated by StackSmart.' : 'Rule-based options. Projection math calculated by StackSmart.'}</p>
            {plan.warnings?.filter(warning => warning.startsWith('Your goal is within three years.')).map(warning => <p key={warning} className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-200">{warning}</p>)}
            <div className="mt-5 grid gap-4">
              {plan.savings_recommendation && (
                <article className="rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-text-primary">{plan.savings_recommendation.name}</h3>
                    <div className="text-right"><p className="font-semibold text-primary">{usd(plan.savings_recommendation.monthly_amount)} / month</p><p className="mt-1 text-sm text-text-secondary">100% of your monthly amount</p></div>
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
              {generatedRisk === 'aggressive' && !plan.savings_recommendation && plan.satellite_stock_ideas.slice(0, 1).map(idea => (
                <article key={idea.ticker} className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-300">Stock to research - separate from your monthly mix</p>
                  <h3 className="mt-2 text-lg font-semibold text-text-primary">{idea.ticker} - {idea.name}</h3>
                  <p className="mt-3 text-sm text-text-secondary">{idea.reason}</p>
                  <p className="mt-2 text-sm text-text-secondary">{idea.risk_note}</p>
                  <p className="mt-3 text-xs text-text-secondary">Screen dated {idea.as_of}. No money is allocated to this idea.</p>
                </article>
              ))}
            </div>
            {generatedRisk === 'aggressive' && !plan.savings_recommendation && plan.satellite_stock_ideas.length === 0 && <p className="mt-3 text-sm text-text-secondary">No current verified stock idea is available, so your options use ETFs.</p>}
            {plan.plan_source === 'rule_based' && !plan.savings_recommendation && <p className="mt-3 text-sm text-text-secondary">Showing a rule-based ETF mix; AI generation is currently disabled.</p>}
            {plan.projection && <ProjectionSection projection={plan.projection} />}
            <p className="mt-5 text-xs leading-relaxed text-text-secondary">Educational examples, not a complete financial plan. ETFs and stocks can lose value. Keep money you need soon in savings.</p>
          </section>
        )}
      </div>
    </main>
  );
}


function duration(months: number): string {
  if (months === 0) return 'now';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? `${years} year${years === 1 ? '' : 's'}` : '', rest ? `${rest} month${rest === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ');
}

function ProjectionSection({ projection: p }: { projection: Projection }) {
  return (
    <section aria-label="Savings projection" className="mt-7 rounded-2xl border border-white/10 bg-surface p-5 sm:p-6">
      <h3 className="text-xl font-semibold text-text-primary">What your monthly amount could grow to</h3>
      <p className="mt-2 text-sm text-text-secondary">Calculated by StackSmart using {usd(p.monthly_amount)} per month and an illustrative {p.annual_rate_percent}% nominal annual rate, compounded monthly.</p>
      {p.goal_amount !== null && <p className="mt-4 font-medium text-text-primary">Your stated target: {usd(p.goal_amount)}{p.goal_months !== null ? ` ${p.goal_months === 0 ? 'needed now' : `in ${duration(p.goal_months)}`}` : ''}</p>}
      <GrowthTimeline key={`${p.monthly_amount}:${p.annual_rate_percent}:${p.goal_months}:${p.goal_amount}`} projection={p} />
      {p.shortfall !== null && <p className="mt-4 text-sm text-text-primary">{p.goal_months === 0 ? 'New monthly deposits cannot fund a goal needed now.' : p.shortfall > 0 ? `At your stated deadline, estimated gap to your target: ${usd(p.shortfall)}.` : 'This illustration reaches your stated savings target within that timeframe.'}</p>}
      {p.required_monthly_amount !== null && <p className="mt-2 text-sm text-text-secondary">To reach that target on time under the same assumptions: {usd(p.required_monthly_amount)} per month.</p>}
      {p.goal_amount !== null && <p className="mt-2 text-sm text-text-secondary">{p.months_to_goal !== null ? `Estimated time to save your target at this monthly amount: ${duration(p.months_to_goal)}.` : `Your target is not reached within this ${p.maximum_months / 12}-year illustration.`}</p>}
      {p.parsing_note && <p className="mt-3 text-xs text-text-secondary">{p.parsing_note}</p>}
      <details className="mt-4 text-xs text-text-secondary"><summary className="cursor-pointer">How this estimate is calculated</summary><p className="mt-2 leading-relaxed">{p.assumptions}</p></details>
      <p className="mt-3 text-xs text-text-secondary">Illustrative assumptions, not a forecast for your timeframe. Rates can change and investments can lose value. A savings target is not a guarantee that you can afford a purchase.</p>
    </section>
  );
}

function GrowthTimeline({ projection: p }: { projection: Projection }) {
  const choices = Array.from(new Map([...p.milestones.filter(point => point.months >= 60), ...(p.goal_point ? [p.goal_point] : [])].map(point => [point.months, point])).values()).sort((a, b) => a.months - b.months);
  const [selected, setSelected] = useState(p.goal_point?.months ?? p.milestones.find(point => point.months === 120)?.months ?? 60);
  const current = choices.find(point => point.months === selected) ?? choices[0];
  if (!current) return null;
  const series = p.series?.length ? p.series : [{ months: 0, balance: 0, contributions: 0, growth: 0 }, ...p.milestones];
  const maximum = Math.max(...series.map(point => Math.max(point.balance, point.contributions)), 1);
  const end = Math.max(...series.map(point => point.months), 1);
  const x = (months: number) => 42 + Math.min(months, end) / end * 450;
  const y = (value: number) => 170 - value / maximum * 150;
  const line = (field: 'balance' | 'contributions') => series.map((point, index) => `${index ? 'L' : 'M'}${x(point.months)},${y(point[field])}`).join(' ');
  const base = `L${x(end)},170 L42,170 Z`;
  const compact = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 }).format(amount);
  const contributedShare = current.balance > 0 ? Math.min(100, Math.max(0, current.contributions / current.balance * 100)) : 100;
  return (
    <div className="mt-5">
      <p className="text-xs leading-relaxed text-text-secondary">If you keep contributing the same amount: no withdrawals, even after your goal date.</p>
      <div role="group" aria-label="Projection timeframe" className="mt-4 flex flex-wrap gap-2">
        {choices.map(point => <button key={point.months} type="button" aria-pressed={selected === point.months} onClick={() => setSelected(point.months)} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selected === point.months ? 'border-primary/50 bg-primary/10 text-primary' : 'border-white/10 text-text-secondary hover:border-white/30'}`}>{point.months === 0 ? 'Now' : duration(point.months)}{point.months === p.goal_months ? ' · Goal' : ''}</button>)}
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4" aria-live="polite" aria-atomic="true">
        <p className="text-sm text-text-secondary">{current.months === 0 ? 'Starting balance' : `After ${duration(current.months)}`}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-primary">{usd(current.balance)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-text-secondary">You contributed</p><p className="mt-1 font-medium text-text-primary">{usd(current.contributions)}</p></div>
          <div><p className="text-xs text-text-secondary">Estimated {current.growth < 0 ? 'loss' : 'growth'}</p><p className={`mt-1 font-medium ${current.growth < 0 ? 'text-amber-300' : 'text-primary'}`}>{usd(current.growth)}</p></div>
        </div>
        <div aria-hidden="true" className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-primary"><div className="bg-slate-500" style={{ width: `${contributedShare}%` }} /></div>
      </div>
      <figure className="mt-5">
        <svg viewBox="0 0 510 200" role="img" aria-label={`Illustrative portfolio growth over ${end / 12} years, comparing total balance with contributions`} className="h-auto w-full">
          {[0, .5, 1].map(fraction => <g key={fraction}><line x1="42" x2="492" y1={y(maximum * fraction)} y2={y(maximum * fraction)} stroke="currentColor" strokeOpacity="0.08" /><text x="35" y={y(maximum * fraction) + 4} textAnchor="end" fill="currentColor" className="text-text-secondary" fontSize="10">{compact(maximum * fraction)}</text></g>)}
          <path d={`${line('balance')} ${base}`} fill="currentColor" className="text-primary" fillOpacity="0.08" />
          <path d={`${line('contributions')} ${base}`} fill="#64748b" fillOpacity="0.14" />
          <path d={line('contributions')} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d={line('balance')} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />
          {current.months <= end && <circle cx={x(current.months)} cy={y(current.balance)} r="4" fill="currentColor" className="text-primary" />}
          {[0, 1 / 3, 2 / 3, 1].map(fraction => <text key={fraction} x={x(end * fraction)} y="191" textAnchor="middle" fill="currentColor" className="text-text-secondary" fontSize="10">{fraction === 0 ? 'Today' : `${Math.round(end * fraction / 12)} years`}</text>)}
        </svg>
        <figcaption className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-secondary"><span><span aria-hidden="true" className="mr-2 inline-block h-0.5 w-3 bg-primary align-middle" />Total balance</span><span><span aria-hidden="true" className="mr-2 inline-block h-0.5 w-3 bg-slate-400 align-middle" />Your contributions</span></figcaption>
      </figure>
    </div>
  );
}
