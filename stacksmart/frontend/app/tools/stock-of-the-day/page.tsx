'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, LineChart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BetaNotice from '@/app/components/BetaNotice';
import FeedbackPanel from '@/app/components/FeedbackPanel';
import { getApiBaseUrl, getApiErrorMessage } from '@/lib/api';
import FactorBreakdownChart from './FactorBreakdownChart';
import { StockOfTheDayPick, FACTOR_KEYS, FACTOR_LABELS, FACTOR_DESCRIPTIONS } from './types';

export default function StockOfTheDayPage() {
  const router = useRouter();
  const { user, session, isLoading: authLoading } = useAuth();

  const [pick, setPick] = useState<StockOfTheDayPick | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading === false && user === null) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!session?.access_token) return;

    const fetchPick = async () => {
      setLoading(true);
      setError(null);
      try {
        const API_BASE_URL = getApiBaseUrl();
        const response = await fetch(`${API_BASE_URL}/api/stock-of-the-day`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.status === 404) {
          setPick(null);
          return;
        }

        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response, "Couldn't load today's pick. Please try again."));
        }

        setPick(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPick();
  }, [session?.access_token]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-text-muted mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <Link
            href="/tools"
            className="flex items-center gap-2 text-text-muted hover:text-text-secondary transition-colors w-fit"
          >
            <ArrowLeft size={20} />
            Back to Tools
          </Link>
          <Link
            href="/tools/stock-of-the-day/backtest"
            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors w-fit"
          >
            <LineChart size={16} />
            View Backtest History
          </Link>
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-primary mb-2">
          Stock of the Day
        </h1>
        <p className="text-text-muted mb-8">
          One ticker a day, picked by a transparent multi-factor model — with the full math shown, not a black box.
        </p>

        <div className="mb-8">
          <BetaNotice
            title="Educational, not investment advice"
            message="This is a rules-based model for learning how factor investing works. It is not personalized advice — do your own research before trading anything."
          />
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {!loading && error && (
          <div className="bg-surface border-l-4 border-destructive rounded-lg p-4 mb-8">
            <p className="text-destructive">Error: {error}</p>
          </div>
        )}

        {!loading && !error && pick === null && (
          <div className="bg-surface border border-border-subtle rounded-xl p-8 text-center">
            <p className="text-text-secondary">
              No pick has been generated yet. Check back after the next morning run.
            </p>
          </div>
        )}

        {!loading && !error && pick && (
          <div className="space-y-6">
            {/* Pick header */}
            <div className="bg-surface border border-border-subtle rounded-xl p-8 text-center">
              <div className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">
                {new Date(`${pick.pick_date}T00:00:00`).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div className="text-5xl font-semibold tracking-tight text-text-primary mb-4">
                {pick.ticker}
              </div>
              <div className="inline-flex items-center gap-2 bg-surface-elevated/50 rounded-lg px-4 py-2">
                <span className="text-text-muted text-sm">Composite Score</span>
                <span
                  className={`text-lg font-semibold ${
                    pick.composite_score >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {pick.composite_score >= 0 ? '+' : ''}
                  {pick.composite_score.toFixed(3)}
                </span>
              </div>
            </div>

            {/* Factor breakdown chart */}
            <div className="bg-surface border border-border-subtle rounded-xl p-6">
              <h2 className="text-xl font-semibold tracking-tight text-text-primary mb-1">
                Why {pick.ticker}?
              </h2>
              <p className="text-sm text-text-muted mb-6">
                Each factor is z-score normalized against the day's candidate pool, then weighted into the composite score.
              </p>
              <FactorBreakdownChart factorBreakdown={pick.factor_breakdown} />
            </div>

            {/* Factor detail table */}
            <div className="bg-surface border border-border-subtle rounded-xl p-6">
              <h2 className="text-xl font-semibold tracking-tight text-text-primary mb-4">
                Factor Detail
              </h2>
              <div className="space-y-4">
                {FACTOR_KEYS.map((key) => {
                  const detail = pick.factor_breakdown[key];
                  const positive = detail.weighted_contribution >= 0;
                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start gap-3">
                        {positive ? (
                          <TrendingUp size={16} className="text-success mt-1 flex-shrink-0" />
                        ) : (
                          <TrendingDown size={16} className="text-destructive mt-1 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-medium text-text-primary text-sm">{FACTOR_LABELS[key]}</div>
                          <div className="text-xs text-text-muted mt-0.5">{FACTOR_DESCRIPTIONS[key]}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 text-xs space-y-0.5">
                        <div className="text-text-secondary">
                          raw: {detail.raw_value !== null ? detail.raw_value.toFixed(3) : 'n/a'}
                        </div>
                        <div className="text-text-secondary">z-score: {detail.zscore.toFixed(3)}</div>
                        <div className="text-text-muted">weight: {(detail.weight * 100).toFixed(0)}%</div>
                        <div className={positive ? 'text-success font-medium' : 'text-destructive font-medium'}>
                          contribution: {detail.weighted_contribution.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <FeedbackPanel source="Stock of the Day" />
          </div>
        )}
      </div>
    </div>
  );
}
