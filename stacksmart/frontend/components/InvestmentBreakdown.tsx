'use client';

import { InvestmentAllocation } from '@/types';

interface InvestmentBreakdownProps {
  allocations: InvestmentAllocation[];
  strategy: string;
  totalMonthly: number;
}

export default function InvestmentBreakdown({
  allocations,
  strategy,
  totalMonthly
}: InvestmentBreakdownProps) {
  const strategyDescriptions = {
    aggressive: 'High growth potential, suitable for 3+ years until graduation',
    moderate: 'Balanced approach for 2-3 year timeline',
    conservative: 'Capital preservation for near-term graduation'
  };

  const riskColors = {
    low: 'bg-surface-elevated border-border text-success',
    medium: 'bg-surface-elevated border-border text-warning',
    high: 'bg-surface-elevated border-border text-destructive'
  };

  return (
    <div className="bg-surface p-8 rounded-xl border border-border-subtle">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-text-primary">Investment Plan</h3>
          <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-medium uppercase tracking-wider">
            {strategy} Strategy
          </div>
        </div>
        <p className="text-text-muted text-sm">
          {strategyDescriptions[strategy as keyof typeof strategyDescriptions]}
        </p>
      </div>

      {/* Total Monthly Investment */}
      <div className="mb-6 p-4 bg-surface-elevated/50 border border-border-subtle rounded-lg">
        <div className="text-sm text-text-muted mb-1">Total Monthly Investment</div>
        <div className="text-3xl font-semibold text-text-primary tracking-tight">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(totalMonthly)}
        </div>
      </div>

      {/* Allocation Cards */}
      <div className="space-y-4">
        {allocations.map((allocation, index) => (
          <div
            key={index}
            className="bg-surface-elevated/30 p-5 rounded-xl border border-border-subtle hover:border-primary/40 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-base font-semibold text-text-primary">
                    {allocation.name}
                  </h4>
                  <span className={`px-2 py-0.5 text-xs rounded border ${riskColors[allocation.risk_level as keyof typeof riskColors]}`}>
                    {allocation.risk_level} risk
                  </span>
                </div>
                <div className="text-sm text-text-muted mb-1">
                  Ticker: <span className="text-primary font-mono">{allocation.ticker}</span>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">
                  {allocation.description}
                </p>
              </div>
            </div>

            {/* Allocation Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-muted">Allocation</span>
                <span className="text-sm font-medium text-text-primary">
                  {allocation.percentage}%
                </span>
              </div>
              <div className="relative h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-gradient-to-r from-primary to-accent-violet rounded-full transition-all duration-500"
                  style={{ width: `${allocation.percentage}%` }}
                />
              </div>
              <div className="mt-2 text-right">
                <span className="text-lg font-semibold text-success">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(allocation.monthly_amount)}
                </span>
                <span className="text-sm text-text-muted/70 ml-1">per month</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* How to Invest Section */}
      <div className="mt-8 p-6 bg-surface-elevated/30 border border-border-subtle rounded-xl">
        <h4 className="text-base font-semibold text-text-primary mb-4">
          How to Get Started
        </h4>
        <div className="space-y-3 text-sm text-text-secondary">
          <div className="flex items-start">
            <span className="text-primary font-medium mr-3">1.</span>
            <div>
              <span className="font-medium text-text-primary">Open a brokerage account:</span>
              <span className="text-text-muted"> Choose Fidelity, Vanguard, or Schwab (commission-free trading)</span>
            </div>
          </div>
          <div className="flex items-start">
            <span className="text-primary font-medium mr-3">2.</span>
            <div>
              <span className="font-medium text-text-primary">Set up automatic investing:</span>
              <span className="text-text-muted"> Schedule monthly transfers on payday</span>
            </div>
          </div>
          <div className="flex items-start">
            <span className="text-primary font-medium mr-3">3.</span>
            <div>
              <span className="font-medium text-text-primary">Buy the ETFs listed above:</span>
              <span className="text-text-muted"> Use the exact percentages shown</span>
            </div>
          </div>
          <div className="flex items-start">
            <span className="text-primary font-medium mr-3">4.</span>
            <div>
              <span className="font-medium text-text-primary">Don't panic sell:</span>
              <span className="text-text-muted"> Markets go up and down. Stay invested through graduation.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
