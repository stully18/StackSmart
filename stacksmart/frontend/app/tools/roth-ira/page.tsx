'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BrokerageLinks from '@/app/components/BrokerageLinks';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, DollarSign, Zap, ShieldCheck } from 'lucide-react';

export default function RothIRAPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [age, setAge] = useState(20);
  const [annualContribution, setAnnualContribution] = useState(7500);
  const [yearsToRetirement, setYearsToRetirement] = useState(45);
  const [expectedReturn, setExpectedReturn] = useState(10);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Calculate Roth IRA growth
  const calculateGrowth = () => {
    const years = yearsToRetirement;
    const rate = expectedReturn / 100;

    // Future value of annuity formula
    const futureValue = annualContribution * (((Math.pow(1 + rate, years) - 1) / rate));

    const totalContributed = annualContribution * years;
    const taxFreeGains = futureValue - totalContributed;

    return {
      futureValue: Math.round(futureValue),
      totalContributed: Math.round(totalContributed),
      taxFreeGains: Math.round(taxFreeGains)
    };
  };

  const results = calculateGrowth();

  // Calculate tax savings (assuming 24% tax bracket)
  const taxSavings = Math.round(results.taxFreeGains * 0.24);

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

        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-primary mb-2">Why Roth IRA is a Superpower for College Students</h1>
        <p className="text-text-muted mb-8">
          The earlier you start, the more powerful it becomes. Let the math convince you.
        </p>

        {/* Key Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-surface border border-border-subtle rounded-xl p-6 hover:border-border transition-colors">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mb-3"><DollarSign size={28} className="text-success" /></div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">Tax-Free Forever</h3>
            <p className="text-text-secondary text-sm">
              All your gains grow TAX-FREE. When you withdraw at retirement, you pay $0 in taxes. Not 1%. Zero.
            </p>
          </div>

          <div className="bg-surface border border-border-subtle rounded-xl p-6 hover:border-border transition-colors">
            <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center mb-3"><Zap size={28} className="text-warning" /></div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">Time is Your Weapon</h3>
            <p className="text-text-secondary text-sm">
              Starting at 20 vs 30 means an extra 10 years of compound growth. That's the difference between $1M and $2M+.
            </p>
          </div>

          <div className="bg-surface border border-border-subtle rounded-xl p-6 hover:border-border transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3"><ShieldCheck size={28} className="text-primary" /></div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">Flexibility</h3>
            <p className="text-text-secondary text-sm">
              You can withdraw contributions (not gains) anytime penalty-free. Emergency fund + retirement in one.
            </p>
          </div>
        </div>

        {/* Calculator */}
        <div className="bg-surface border border-border-subtle rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-6">Roth IRA Growth Calculator</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Your Current Age: {age}
              </label>
              <input
                type="range"
                min="18"
                max="30"
                value={age}
                onChange={(e) => {
                  const newAge = parseInt(e.target.value);
                  setAge(newAge);
                  setYearsToRetirement(65 - newAge);
                }}
                className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Annual Contribution: ${annualContribution.toLocaleString()}
              </label>
              <input
                type="range"
                min="1000"
                max="7500"
                step="500"
                value={annualContribution}
                onChange={(e) => setAnnualContribution(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-text-muted/70 mt-1">Max contribution: $7,500/year (2026 limit)</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Years Until Retirement (65): {yearsToRetirement}
              </label>
              <input
                type="range"
                min="20"
                max="50"
                value={yearsToRetirement}
                onChange={(e) => setYearsToRetirement(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Expected Annual Return: {expectedReturn}%
              </label>
              <input
                type="range"
                min="5"
                max="12"
                step="0.5"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(parseFloat(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-text-muted/70 mt-1">S&P 500 historical average: ~10%</div>
            </div>
          </div>

          {/* Results */}
          <div className="bg-surface-elevated/50 border border-border-subtle rounded-xl p-6">
            <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Your Roth IRA at Age {age + yearsToRetirement}</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-text-muted text-sm mb-1">Total You Contributed</div>
                <div className="text-2xl font-semibold text-primary">
                  ${results.totalContributed.toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-text-muted text-sm mb-1">Tax-Free Gains</div>
                <div className="text-2xl font-semibold text-success">
                  ${results.taxFreeGains.toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-text-muted text-sm mb-1">Total Value</div>
                <div className="text-3xl font-semibold text-text-primary">
                  ${results.futureValue.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border-subtle">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Tax Savings (vs taxable account):</span>
                <span className="text-2xl font-semibold text-warning">${taxSavings.toLocaleString()}</span>
              </div>
              <p className="text-sm text-text-muted/70 mt-2">
                This is money you'd pay to the IRS if this was a regular brokerage account. With a Roth IRA, you keep it all.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-surface border border-border-subtle rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-4">How Roth IRA Works</h2>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">1</div>
              <div>
                <h4 className="font-semibold text-text-primary mb-1">Contribute After-Tax Money</h4>
                <p className="text-text-muted text-sm">
                  You contribute money you've already paid taxes on. Up to $7,500/year (2026 limit).
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">2</div>
              <div>
                <h4 className="font-semibold text-text-primary mb-1">Invest Inside the Roth IRA</h4>
                <p className="text-text-muted text-sm">
                  Buy ETFs like VOO, VTI, VXUS inside your Roth IRA. Same investing, but tax-advantaged.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">3</div>
              <div>
                <h4 className="font-semibold text-text-primary mb-1">Growth is 100% Tax-Free</h4>
                <p className="text-text-muted text-sm">
                  Your money grows for decades. Dividends, capital gains, everything compounds tax-free.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">4</div>
              <div>
                <h4 className="font-semibold text-text-primary mb-1">Withdraw Tax-Free at Retirement (59 1/2)</h4>
                <p className="text-text-muted text-sm">
                  After age 59 1/2, withdraw it all tax-free. Your $315,000 (from example above) becomes $315,000 in your pocket, not $239,400.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Common Questions */}
        <div className="bg-surface border border-border-subtle rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-4">Common Questions</h2>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-primary">Can I withdraw my money if I need it?</h4>
              <p className="text-text-secondary text-sm">
                Yes! You can withdraw your <strong className="text-text-primary">contributions</strong> (not gains) anytime, tax and penalty-free.
                If you contribute $7,000 this year, you can take that $7,000 out later if needed. The gains must stay until 59 1/2.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">Do I qualify?</h4>
              <p className="text-text-secondary text-sm">
                You must have earned income (job, internship, self-employment). Income limits: Single filers making less than $161,000 can contribute the full amount (2024).
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">Which is better: Roth IRA or 401(k)?</h4>
              <p className="text-text-secondary text-sm">
                Do <strong className="text-text-primary">both</strong> if you can. 401(k) gets company match (free money). Roth IRA has more investment options and tax-free withdrawals.
                Priority: 401(k) to match, then Roth IRA max, then more 401(k).
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">What if I don't have $7,500/year?</h4>
              <p className="text-text-secondary text-sm">
                That's okay! Even $100/month ($1,200/year) is powerful. The key is starting early and being consistent.
                $1,200/year from age 20-65 at 10% = $895,000.
              </p>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-surface border border-border-subtle rounded-xl p-6">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-4">Ready to Start?</h2>

          <ol className="space-y-3 mb-6">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gradient-cta rounded-full flex items-center justify-center text-sm font-semibold">1</span>
              <span className="text-text-secondary">Open a Roth IRA at Fidelity, Vanguard, or Schwab (all free, no minimums)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gradient-cta rounded-full flex items-center justify-center text-sm font-semibold">2</span>
              <span className="text-text-secondary">Link your bank account and transfer your first contribution</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gradient-cta rounded-full flex items-center justify-center text-sm font-semibold">3</span>
              <span className="text-text-secondary">Buy your first ETF (VOO or VTI - can't go wrong)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gradient-cta rounded-full flex items-center justify-center text-sm font-semibold">4</span>
              <span className="text-text-secondary">Set up automatic monthly contributions and forget about it</span>
            </li>
          </ol>

          <BrokerageLinks />

          <div className="bg-surface-elevated/30 border-l-4 border-warning border-t border-r border-b border-t-border-subtle border-r-border-subtle border-b-border-subtle rounded-lg p-4">
            <p className="text-warning font-semibold mb-2">The Best Time to Start Was Yesterday</p>
            <p className="text-text-secondary text-sm">
              The second best time is today. Every year you wait costs you tens of thousands in lost growth.
              Even if you can only contribute $1,000 this year, that's $1,000 growing tax-free for 45 years.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
