'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import BetaNotice from '@/app/components/BetaNotice';
import { getApiBaseUrl, getApiErrorMessage } from '@/lib/api';
import { PerformanceRecord, PerformanceSummary } from '../types';

const WINDOWS: { key: '1d' | '5d' | '20d'; label: string }[] = [
  { key: '1d', label: '1 Day' },
  { key: '5d', label: '5 Days' },
  { key: '20d', label: '20 Days' },
];

function formatPercent(value: number | null): string {
  if (value === null) return 'n/a';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}

export default function StockOfTheDayBacktestPage() {
  const router = useRouter();
  const { user, session, isLoading: authLoading } = useAuth();

  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading === false && user === null) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!session?.access_token) return;

    const fetchPerformance = async () => {
      setLoading(true);
      setError(null);
      try {
        const API_BASE_URL = getApiBaseUrl();
        const response = await fetch(`${API_BASE_URL}/api/stock-of-the-day/performance?days=90`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response, "Couldn't load backtest history. Please try again."));
        }

        const data = await response.json();
        setRecords(data.performance);
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
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
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/tools/stock-of-the-day"
            className="flex items-center gap-2 text-text-muted hover:text-text-secondary transition-colors w-fit"
          >
            <ArrowLeft size={20} />
            Back to Stock of the Day
          </Link>
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-primary mb-2">
          Backtest History
        </h1>
        <p className="text-text-muted mb-8">
          How past picks actually performed vs the S&amp;P 500, tracked automatically at 1, 5, and 20 trading days out.
        </p>

        <div className="mb-8">
          <BetaNotice
            title="Past performance isn't a promise"
            message="These are real, unedited results from the model's daily picks. Small sample sizes early on will be noisy — treat win rate as a learning signal, not a guarantee."
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

        {!loading && !error && (
          <div className="space-y-8">
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {WINDOWS.map(({ key, label }) => {
                const stats = summary?.[key] ?? null;
                return (
                  <div key={key} className="bg-surface border border-border-subtle rounded-xl p-5">
                    <div className="text-sm text-text-muted mb-3">{label} Window</div>
                    {stats === null ? (
                      <div className="text-text-muted text-sm">Not enough data yet</div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-text-muted">Avg Return (pick vs SPY)</div>
                          <div className="text-lg font-semibold text-text-primary">
                            {formatPercent(stats.avg_return)}{' '}
                            <span className="text-text-muted text-sm font-normal">
                              vs {formatPercent(stats.avg_spy_return)}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-text-muted">Win Rate vs SPY</div>
                          <div className="text-lg font-semibold text-primary">
                            {(stats.win_rate_vs_spy * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="text-xs text-text-muted">n = {stats.sample_size}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pick history table */}
            <div className="bg-surface border border-border-subtle rounded-xl p-6 overflow-x-auto">
              <h2 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Pick History</h2>
              {records.length === 0 ? (
                <p className="text-text-muted text-sm">No performance data yet.</p>
              ) : (
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-border-subtle">
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 pr-4 font-medium">Ticker</th>
                      <th className="pb-3 pr-4 font-medium">1d</th>
                      <th className="pb-3 pr-4 font-medium">5d</th>
                      <th className="pb-3 pr-4 font-medium">20d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row) => (
                      <tr key={row.pick_date} className="border-b border-border-subtle last:border-b-0">
                        <td className="py-3 pr-4 text-text-secondary">
                          {new Date(`${row.pick_date}T00:00:00`).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 pr-4 font-medium text-text-primary">{row.ticker}</td>
                        <td className={`py-3 pr-4 ${row.return_1d !== null && row.return_1d >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatPercent(row.return_1d)}
                        </td>
                        <td className={`py-3 pr-4 ${row.return_5d !== null && row.return_5d >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatPercent(row.return_5d)}
                        </td>
                        <td className={`py-3 pr-4 ${row.return_20d !== null && row.return_20d >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatPercent(row.return_20d)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
