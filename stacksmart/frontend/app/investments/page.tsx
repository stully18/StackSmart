'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import PlaidInvestmentButton from '@/components/PlaidInvestmentButton';
import InvestmentDashboard from '@/components/InvestmentDashboard';
import { ErrorAlert } from '../components/Alerts';
import { ArrowLeft, BarChart3, Check } from 'lucide-react';

export default function InvestmentsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Investments feature is not yet live — redirect to tools
  useEffect(() => {
    router.replace('/tools');
  }, [router]);

  const handleInvestmentConnection = async (publicToken: string) => {
    try {
      // Exchange public token for access token
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;
      const response = await fetch(`${API_BASE_URL}/api/plaid/exchange-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken })
      });

      const data = await response.json();
      setAccessToken(data.access_token);
      setIsConnected(true);
    } catch (error) {
      console.error('Error connecting investment account:', error);
      setError('Failed to connect investment account. Please try again.');
    }
  };

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
    <>
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
      <div className="min-h-screen bg-background text-white p-8">
        <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <a
            href="/"
            className="flex items-center gap-2 text-text-muted hover:text-text-secondary transition-colors w-fit"
          >
            <ArrowLeft size={20} />
            Back to Optimizer
          </a>
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-text-primary mb-2">Investment Analysis</h1>
        <p className="text-text-muted mb-8">
          Connect your Fidelity account to analyze your portfolio and get personalized recommendations
        </p>

        {!isConnected ? (
          <div className="bg-surface border border-border-subtle rounded-xl p-8 text-center">
            <div className="max-w-md mx-auto">
              <BarChart3 size={96} className="mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-2">Connect Your Investment Account</h2>
              <p className="text-text-muted mb-6">
                Securely connect your Fidelity, Robinhood, or other brokerage account to get started
              </p>

              <PlaidInvestmentButton
                onSuccess={handleInvestmentConnection}
              />

              <div className="mt-6 pt-6 border-t border-border-subtle">
                <h3 className="font-semibold text-text-primary mb-2">What you'll get:</h3>
                <ul className="text-left text-sm text-text-muted space-y-1">
                  <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Portfolio diversification analysis</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Asset allocation breakdown</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Recurring deposit detection</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Investment health score</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Personalized recommendations</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Fee analysis</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <InvestmentDashboard accessToken={accessToken!} />
        )}
        </div>
      </div>
    </>
  );
}
