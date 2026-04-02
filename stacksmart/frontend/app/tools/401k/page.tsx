'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Check, X } from 'lucide-react';

export default function Calculator401kPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // Input states
  const [salary, setSalary] = useState(60000);
  const [contributionPercent, setContributionPercent] = useState(6);
  const [employerMatchPercent, setEmployerMatchPercent] = useState(50);
  const [employerMatchCap, setEmployerMatchCap] = useState(6);
  const [yearsToRetirement, setYearsToRetirement] = useState(40);
  const [expectedReturn, setExpectedReturn] = useState(7);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Calculate 401(k) growth
  const calculateGrowth = () => {
    // Annual employee contribution
    const annualContribution = salary * (contributionPercent / 100);

    // Employer contribution = salary * min(contribution%, cap%) * match%
    const effectiveEmployerContributionPercent = Math.min(contributionPercent, employerMatchCap);
    const annualEmployerMatch = salary * (effectiveEmployerContributionPercent / 100) * (employerMatchPercent / 100);

    // Total annual contribution
    const totalAnnualContribution = annualContribution + annualEmployerMatch;

    // Future value calculation using compound interest with annual contributions
    const rate = expectedReturn / 100;
    const years = yearsToRetirement;

    // Future value of annuity formula: PMT * (((1 + r)^n - 1) / r)
    const futureValue = totalAnnualContribution * (((Math.pow(1 + rate, years) - 1) / rate));

    // Calculate totals
    const totalEmployeeContributions = annualContribution * years;
    const totalEmployerContributions = annualEmployerMatch * years;
    const totalContributions = totalEmployeeContributions + totalEmployerContributions;
    const investmentGains = futureValue - totalContributions;

    return {
      annualContribution: Math.round(annualContribution),
      annualEmployerMatch: Math.round(annualEmployerMatch),
      totalAnnualContribution: Math.round(totalAnnualContribution),
      futureValue: Math.round(futureValue),
      totalEmployeeContributions: Math.round(totalEmployeeContributions),
      totalEmployerContributions: Math.round(totalEmployerContributions),
      investmentGains: Math.round(investmentGains),
    };
  };

  const results = calculateGrowth();

  // Calculate "free money" left on the table if not contributing enough
  const maxMatchContribution = salary * (employerMatchCap / 100) * (employerMatchPercent / 100);
  const freeMoneyLeftOnTable = Math.max(0, maxMatchContribution - results.annualEmployerMatch);

  // Show loading while checking authentication, or if not authenticated
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
    <div className="min-h-screen bg-background text-white p-8">
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

        <h1 className="text-4xl font-semibold tracking-tight text-text-primary mb-2">
          401(k) Calculator
        </h1>
        <p className="text-text-muted mb-8">
          Calculate your retirement savings with employer matching - don't leave free money on the table!
        </p>

        {/* Free Money Alert */}
        {freeMoneyLeftOnTable > 0 && (
          <div className="bg-surface border-l-4 border-destructive border-t border-r border-b border-t-border-subtle border-r-border-subtle border-b-border-subtle rounded-lg p-4 mb-8">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-semibold text-destructive text-lg">
                  You're leaving ${freeMoneyLeftOnTable.toLocaleString()}/year in FREE money on the table!
                </p>
                <p className="text-text-secondary text-sm">
                  Increase your contribution to at least {employerMatchCap}% to get the full employer match.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Calculator */}
        <div className="bg-surface border border-border-subtle rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-6">Your 401(k) Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Salary */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Annual Salary: ${salary.toLocaleString()}
              </label>
              <input
                type="range"
                min="30000"
                max="200000"
                step="5000"
                value={salary}
                onChange={(e) => setSalary(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-text-muted/70 mt-1">
                <span>$30k</span>
                <span>$200k</span>
              </div>
            </div>

            {/* Your Contribution % */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Your Contribution: {contributionPercent}% (${results.annualContribution.toLocaleString()}/yr)
              </label>
              <input
                type="range"
                min="1"
                max="22"
                step="1"
                value={contributionPercent}
                onChange={(e) => setContributionPercent(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-text-muted/70 mt-1">
                <span>1%</span>
                <span>22% (IRS limit)</span>
              </div>
            </div>

            {/* Employer Match % */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Employer Match Rate: {employerMatchPercent}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="25"
                value={employerMatchPercent}
                onChange={(e) => setEmployerMatchPercent(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-text-muted/70 mt-1">
                <span>0%</span>
                <span>50% (common)</span>
                <span>100%</span>
              </div>
            </div>

            {/* Employer Match Cap */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Employer Match Cap: {employerMatchCap}% of salary
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={employerMatchCap}
                onChange={(e) => setEmployerMatchCap(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-text-muted/70 mt-1">
                <span>0%</span>
                <span>3-6% (common)</span>
                <span>10%</span>
              </div>
            </div>

            {/* Years to Retirement */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Years Until Retirement: {yearsToRetirement}
              </label>
              <input
                type="range"
                min="5"
                max="45"
                value={yearsToRetirement}
                onChange={(e) => setYearsToRetirement(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-text-muted/70 mt-1">
                <span>5 years</span>
                <span>45 years</span>
              </div>
            </div>

            {/* Expected Return */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Expected Annual Return: {expectedReturn}%
              </label>
              <input
                type="range"
                min="4"
                max="10"
                step="0.5"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(parseFloat(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-text-muted/70 mt-1">
                <span>4% (conservative)</span>
                <span>7% (balanced)</span>
                <span>10% (aggressive)</span>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="bg-surface-elevated/50 border border-border-subtle rounded-xl p-6">
            <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">Annual Contribution Breakdown</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <div className="text-text-muted text-sm mb-1">Your Contribution</div>
                <div className="text-2xl font-semibold text-primary">
                  ${results.annualContribution.toLocaleString()}/yr
                </div>
              </div>

              <div>
                <div className="text-text-muted text-sm mb-1">Employer Match (Free Money!)</div>
                <div className="text-2xl font-semibold text-success">
                  +${results.annualEmployerMatch.toLocaleString()}/yr
                </div>
              </div>

              <div>
                <div className="text-text-muted text-sm mb-1">Total Annual</div>
                <div className="text-2xl font-semibold text-text-primary">
                  ${results.totalAnnualContribution.toLocaleString()}/yr
                </div>
              </div>
            </div>

            <div className="border-t border-border-subtle pt-6">
              <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-4">After {yearsToRetirement} Years</h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-surface border border-border-subtle rounded-lg p-4">
                  <div className="text-text-muted text-sm mb-1">You Contributed</div>
                  <div className="text-xl font-semibold text-primary">
                    ${results.totalEmployeeContributions.toLocaleString()}
                  </div>
                </div>

                <div className="bg-surface border border-border-subtle rounded-lg p-4">
                  <div className="text-text-muted text-sm mb-1">Employer Contributed</div>
                  <div className="text-xl font-semibold text-success">
                    ${results.totalEmployerContributions.toLocaleString()}
                  </div>
                </div>

                <div className="bg-surface border border-border-subtle rounded-lg p-4">
                  <div className="text-text-muted text-sm mb-1">Investment Gains</div>
                  <div className="text-xl font-semibold text-warning">
                    ${results.investmentGains.toLocaleString()}
                  </div>
                </div>

                <div className="bg-surface border-2 border-primary/30 rounded-lg p-4">
                  <div className="text-text-secondary text-sm mb-1">Total 401(k) Value</div>
                  <div className="text-2xl font-semibold text-text-primary">
                    ${results.futureValue.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 401(k) Basics for New Grads */}
        <div className="bg-surface border border-border-subtle rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-4">401(k) Basics for New Grads</h2>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">1</div>
              <div>
                <h4 className="font-semibold text-text-primary mb-1">Enroll ASAP</h4>
                <p className="text-text-muted text-sm">
                  Sign up for your company's 401(k) on day one. Most employers let you enroll during onboarding or have specific enrollment periods.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">2</div>
              <div>
                <h4 className="font-semibold text-text-primary mb-1">Contribute at Least to the Match</h4>
                <p className="text-text-muted text-sm">
                  If your employer matches 50% up to 6%, contribute at least 6%. That's a guaranteed 50% return on your money before any market gains!
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">3</div>
              <div>
                <h4 className="font-semibold text-text-primary mb-1">Choose Your Investments</h4>
                <p className="text-text-muted text-sm">
                  Most 401(k)s offer target-date funds (like "Target 2060"). Pick the one closest to when you'll retire. It automatically adjusts risk as you age.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">4</div>
              <div>
                <h4 className="font-semibold text-text-primary mb-1">Increase Contributions Over Time</h4>
                <p className="text-text-muted text-sm">
                  Start at the match minimum, then increase 1% each year or whenever you get a raise. Goal: max out at $23,000/year (2024 limit).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Traditional vs Roth 401(k) */}
        <div className="bg-surface border border-border-subtle rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-4">Traditional vs Roth 401(k)</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-elevated/30 border-t-4 border-t-primary border border-border-subtle rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-3 text-primary">Traditional 401(k)</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-success" />
                  Tax deduction NOW (lowers your current taxable income)
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-success" />
                  Great if you're in a high tax bracket now
                </li>
                <li className="flex items-start gap-2">
                  <X size={14} className="text-destructive" />
                  Pay taxes when you withdraw in retirement
                </li>
              </ul>
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <p className="text-xs text-text-muted">
                  Best for: Higher earners who expect to be in a lower tax bracket in retirement
                </p>
              </div>
            </div>

            <div className="bg-surface-elevated/30 border-t-4 border-t-success border border-border-subtle rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-3 text-success">Roth 401(k)</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-success" />
                  Tax-FREE withdrawals in retirement
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-success" />
                  Great for new grads in low tax brackets
                </li>
                <li className="flex items-start gap-2">
                  <X size={14} className="text-destructive" />
                  No tax deduction now (you pay taxes upfront)
                </li>
              </ul>
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <p className="text-xs text-text-muted">
                  Best for: New grads / lower earners who expect higher income later
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-surface-elevated/30 border-l-4 border-warning border-t border-r border-b border-t-border-subtle border-r-border-subtle border-b-border-subtle rounded-lg p-4">
            <p className="text-warning font-semibold mb-2">Pro Tip for New Grads</p>
            <p className="text-text-secondary text-sm">
              If you're just starting your career, you're probably in one of the lowest tax brackets you'll ever be in.
              <strong className="text-text-primary"> Choose Roth 401(k) if available</strong> - pay the lower taxes now and enjoy tax-free growth forever.
            </p>
          </div>
        </div>

        {/* Link to Roth IRA */}
        <div className="bg-surface border border-border-subtle rounded-xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-2">Already Maxing Your 401(k) Match?</h3>
              <p className="text-text-muted">
                Next step: Open a Roth IRA for even more tax-advantaged retirement savings.
              </p>
            </div>
            <Link
              href="/tools/roth-ira"
              className="px-6 py-3 btn-gradient rounded-lg font-semibold transition-colors active:scale-[0.98]"
            >
              Learn About Roth IRA
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
