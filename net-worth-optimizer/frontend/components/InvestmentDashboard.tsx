'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Minus, TrendingUp } from 'lucide-react';

interface InvestmentDashboardProps {
  accessToken: string;
}

interface AnalysisData {
  holdings_summary: {
    total_value: number;
    holdings_count: number;
    accounts: any[];
  };
  holdings: any[];
  recent_transactions: any[];
  analysis: {
    health_score: number;
    recommendations: string[];
    strengths: string[];
    warnings: string[];
    asset_allocation?: {
      stocks: number;
      bonds: number;
      other: number;
    };
    recurring_deposits?: {
      detected: boolean;
      average_monthly?: number;
      months_active?: number;
    };
    fee_analysis?: {
      total_fees: number;
      average_per_trade: number;
    };
  };
}

export default function InvestmentDashboard({ accessToken }: InvestmentDashboardProps) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvestmentData = async () => {
      try {
        setIsLoading(true);
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE_URL}/api/investments/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken, days_back: 365 })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch investment data');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvestmentData();
  }, [accessToken]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin mx-auto mb-4 text-primary" />
          <p className="text-text-secondary">Analyzing your portfolio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface border-l-4 border-destructive rounded-lg p-6 text-center">
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { holdings_summary, holdings, recent_transactions, analysis } = data;

  return (
    <div className="space-y-6">
      {/* Health Score Card */}
      <div className="bg-surface border border-border-subtle rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-1">Investment Health Score</h2>
            <p className="text-text-muted text-sm">Based on diversification, allocation, and investing habits</p>
          </div>
          <div className="text-center">
            <div className={`text-6xl font-semibold tracking-tight ${
              analysis.health_score >= 80 ? 'text-success' :
              analysis.health_score >= 60 ? 'text-warning' :
              'text-destructive'
            }`}>
              {analysis.health_score}
            </div>
            <div className="text-text-muted text-sm">/ 100</div>
          </div>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border-subtle rounded-xl p-6">
          <div className="text-text-muted text-sm mb-1">Total Portfolio Value</div>
          <div className="text-3xl font-semibold tracking-tight text-success">
            ${holdings_summary.total_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-surface border border-border-subtle rounded-xl p-6">
          <div className="text-text-muted text-sm mb-1">Total Holdings</div>
          <div className="text-3xl font-semibold tracking-tight text-text-primary">{holdings_summary.holdings_count}</div>
        </div>

        <div className="bg-surface border border-border-subtle rounded-xl p-6">
          <div className="text-text-muted text-sm mb-1">Accounts</div>
          <div className="text-3xl font-semibold tracking-tight text-text-primary">{holdings_summary.accounts.length}</div>
        </div>
      </div>

      {/* Asset Allocation */}
      {analysis.asset_allocation && (
        <div className="bg-surface border border-border-subtle rounded-xl p-6">
          <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Asset Allocation</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-text-secondary">Stocks & ETFs</span>
                <span className="font-semibold text-text-primary">{analysis.asset_allocation.stocks}%</span>
              </div>
              <div className="w-full bg-surface-elevated rounded-full h-1.5">
                <div className="bg-gradient-to-r from-primary to-primary-hover h-1.5 rounded-full" style={{ width: `${analysis.asset_allocation.stocks}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-text-secondary">Bonds</span>
                <span className="font-semibold text-text-primary">{analysis.asset_allocation.bonds}%</span>
              </div>
              <div className="w-full bg-surface-elevated rounded-full h-1.5">
                <div className="bg-success h-1.5 rounded-full" style={{ width: `${analysis.asset_allocation.bonds}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-text-secondary">Other</span>
                <span className="font-semibold text-text-primary">{analysis.asset_allocation.other}%</span>
              </div>
              <div className="w-full bg-surface-elevated rounded-full h-1.5">
                <div className="bg-warning h-1.5 rounded-full" style={{ width: `${analysis.asset_allocation.other}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recurring Deposits */}
      {analysis.recurring_deposits && analysis.recurring_deposits.detected && (
        <div className="bg-surface border-l-4 border-success border-t border-r border-b border-t-border-subtle border-r-border-subtle border-b-border-subtle rounded-lg p-6">
          <h3 className="text-xl font-semibold tracking-tight mb-2 text-success">Recurring Deposits Detected</h3>
          <p className="text-text-secondary">
            You're consistently investing <span className="font-semibold text-success">
              ${analysis.recurring_deposits.average_monthly?.toLocaleString()}/month
            </span> across {analysis.recurring_deposits.months_active} months.
          </p>
          <p className="text-sm text-text-muted mt-2">
            Keep it up! Dollar-cost averaging is a proven strategy for long-term growth.
          </p>
        </div>
      )}

      {/* Strengths, Warnings, Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {analysis.strengths.length > 0 && (
          <div className="bg-surface border border-border-subtle rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-3 text-success">Strengths</h3>
            <ul className="space-y-2 text-sm">
              {analysis.strengths.map((strength, idx) => (
                <li key={idx} className="text-text-secondary flex items-start gap-2">
                  <Plus size={14} className="text-success mt-0.5 shrink-0" />
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.warnings.length > 0 && (
          <div className="bg-surface border border-border-subtle rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-3 text-destructive">Warnings</h3>
            <ul className="space-y-2 text-sm">
              {analysis.warnings.map((warning, idx) => (
                <li key={idx} className="text-text-secondary flex items-start gap-2">
                  <Minus size={14} className="text-destructive mt-0.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.recommendations.length > 0 && (
          <div className="bg-surface border border-border-subtle rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-3 text-warning">Recommendations</h3>
            <ul className="space-y-2 text-sm">
              {analysis.recommendations.map((rec, idx) => (
                <li key={idx} className="text-text-secondary flex items-start gap-2">
                  <TrendingUp size={14} className="text-primary mt-0.5 shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Holdings Table */}
      <div className="bg-surface border border-border-subtle rounded-xl p-6">
        <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Your Holdings</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left py-2 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Ticker</th>
                <th className="text-left py-2 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Name</th>
                <th className="text-right py-2 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Quantity</th>
                <th className="text-right py-2 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Price</th>
                <th className="text-right py-2 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Value</th>
                <th className="text-right py-2 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding, idx) => (
                <tr key={idx} className="border-b border-border-subtle/50 hover:bg-surface-elevated/50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-text-primary">{holding.ticker || 'N/A'}</td>
                  <td className="py-3 px-4 text-sm text-text-secondary">{holding.name}</td>
                  <td className="py-3 px-4 text-right text-text-secondary">{holding.quantity.toFixed(4)}</td>
                  <td className="py-3 px-4 text-right text-text-secondary">${holding.price.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-text-primary">
                    ${holding.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-3 px-4 text-right font-semibold ${
                    holding.gain_loss ? (holding.gain_loss > 0 ? 'text-success' : 'text-destructive') : 'text-text-muted'
                  }`}>
                    {holding.gain_loss ? (
                      <>
                        ${Math.abs(holding.gain_loss).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        <span className="text-xs ml-1">
                          ({holding.gain_loss_percent > 0 ? '+' : ''}{holding.gain_loss_percent.toFixed(1)}%)
                        </span>
                      </>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions */}
      {recent_transactions.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-xl p-6">
          <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {recent_transactions.map((txn, idx) => (
              <div key={idx} className="flex justify-between items-center border-b border-border-subtle/50 pb-3">
                <div>
                  <div className="font-semibold text-text-primary">{txn.ticker || 'N/A'} - {txn.type.toUpperCase()}</div>
                  <div className="text-sm text-text-muted">{txn.date}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-text-primary">${Math.abs(txn.amount).toLocaleString()}</div>
                  {txn.quantity > 0 && (
                    <div className="text-sm text-text-muted">{txn.quantity} shares @ ${txn.price.toFixed(2)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
