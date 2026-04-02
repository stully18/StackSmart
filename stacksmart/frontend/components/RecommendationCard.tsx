'use client';

interface RecommendationCardProps {
  recommendation: string;
  netWorthDebtPath: number;
  netWorthInvestPath: number;
  confidenceScore: number;
}

export default function RecommendationCard({
  recommendation,
  netWorthDebtPath,
  netWorthInvestPath,
  confidenceScore
}: RecommendationCardProps) {
  const isPayDebt = recommendation === 'pay_debt';
  const winningValue = isPayDebt ? netWorthDebtPath : netWorthInvestPath;
  const losingValue = isPayDebt ? netWorthInvestPath : netWorthDebtPath;
  const advantage = winningValue - losingValue;

  return (
    <div className={`p-8 rounded-xl border-l-4 bg-surface border-t border-r border-b border-t-border-subtle border-r-border-subtle border-b-border-subtle ${
      isPayDebt ? 'border-l-destructive' : 'border-l-success'
    }`}>
      <div className="text-center">
        <div className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">
          Optimal Strategy
        </div>
        <div className={`text-4xl font-semibold mb-4 tracking-tight ${
          isPayDebt ? 'text-destructive' : 'text-success'
        }`}>
          {isPayDebt ? 'Pay Debt' : 'Invest'}
        </div>

        <div className="space-y-3 mb-6">
          <div>
            <div className="text-text-muted text-sm">Net Worth at Graduation</div>
            <div className="text-3xl font-semibold text-text-primary tracking-tight">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0
              }).format(winningValue)}
            </div>
          </div>

          <div className="text-sm text-text-muted">
            <span className={isPayDebt ? 'text-destructive' : 'text-success'}>
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                signDisplay: 'always'
              }).format(advantage)}
            </span>
            {' '}better than the alternative
          </div>
        </div>

        <div className="bg-surface-elevated/50 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-text-muted">Confidence</span>
            <span className="text-text-primary font-medium">
              {(confidenceScore * 100).toFixed(0)}%
            </span>
          </div>
          <div className="bg-surface-elevated rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${isPayDebt ? 'bg-destructive' : 'bg-success'}`}
              style={{ width: `${confidenceScore * 100}%` }}
            />
          </div>
        </div>

        <div className="mt-6 p-4 bg-surface-elevated/30 rounded-lg border border-border-subtle">
          <p className="text-xs text-text-secondary leading-relaxed">
            {isPayDebt ? (
              <>
                Your loan interest rate is higher than the S&P 500's 10% historical average return.
                Paying debt is a <span className="text-text-primary font-medium">guaranteed return</span> - eliminate it first.
              </>
            ) : (
              <>
                The S&P 500's 10% historical return beats your loan interest rate.
                Pay minimums and invest the difference for maximum wealth growth.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
