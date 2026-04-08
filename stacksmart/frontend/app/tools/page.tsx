'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import ToolCard from '@/components/ToolCard';
import { CreditCard, Landmark, BarChart3, ShieldCheck } from 'lucide-react';
import { AuroraBackground } from '@/app/components/ui/aurora-background';

export default function ToolsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading === false && user === null) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

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

  const tools = [
    {
      href: '/tools/debt-optimizer',
      icon: <CreditCard size={24} />,
      title: 'Debt Optimizer',
      description: 'Add all your loans and find the optimal payoff strategy vs investing',
      features: [
        'Multi-loan support (student, car, credit card)',
        'Avalanche vs snowball comparison',
        'Live VOO market data',
        'Pay debt or invest recommendation',
      ],
    },
    {
      href: '/tools/401k',
      icon: <Landmark size={24} />,
      title: '401(k) Calculator',
      description: 'Calculate your 401(k) growth with employer matching contributions',
      features: [
        'Employer match calculator',
        'Contribution optimization',
        'Retirement projections',
        'Traditional vs Roth 401(k) comparison',
      ],
    },
    {
      href: '/tools/investment-plan',
      icon: <BarChart3 size={24} />,
      title: 'Investment Plan',
      description: 'Get a personalized ETF portfolio based on your goals and risk tolerance',
      features: [
        'Risk-adjusted portfolios',
        'Live ETF prices',
        '10-30 year projections',
        'Actionable next steps',
      ],
    },
    {
      href: '/tools/roth-ira',
      icon: <ShieldCheck size={24} />,
      title: 'Roth IRA Calculator',
      description: 'See why starting a Roth IRA in college is your financial superpower',
      features: [
        'Tax-free growth calculator',
        'Early starter advantage',
        'Contribution flexibility',
        'Step-by-step guide',
      ],
    },
  ];

  return (
    <AuroraBackground className="min-h-screen bg-background text-white px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-primary mb-4">
            Financial Tools
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto">
            Everything you need to optimize your finances as a college student or new grad.
            Start with debt optimization, then build your investment strategy.
          </p>
        </div>

        {/* Tool Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tools.map((tool) => (
            <ToolCard key={tool.href} {...tool} />
          ))}
        </div>

        {/* Quick Tips */}
        <div className="mt-12 bg-surface border border-border-subtle rounded-xl p-6">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary mb-4">
            Recommended Order
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">1</span>
              <div>
                <div className="font-semibold text-text-primary">Debt Optimizer</div>
                <div className="text-sm text-text-muted">See if you should pay debt first</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">2</span>
              <div>
                <div className="font-semibold text-text-primary">401(k) Calculator</div>
                <div className="text-sm text-text-muted">Max your employer match</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">3</span>
              <div>
                <div className="font-semibold text-text-primary">Roth IRA</div>
                <div className="text-sm text-text-muted">Tax-free retirement savings</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-gradient-cta rounded-full flex items-center justify-center font-semibold text-sm">4</span>
              <div>
                <div className="font-semibold text-text-primary">Investment Plan</div>
                <div className="text-sm text-text-muted">Build your portfolio</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuroraBackground>
  );
}
