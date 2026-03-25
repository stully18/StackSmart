'use client';

import { useCallback, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { BarChart3, Loader2 } from 'lucide-react';

interface PlaidInvestmentButtonProps {
  onSuccess: (publicToken: string) => void;
}

export default function PlaidInvestmentButton({ onSuccess }: PlaidInvestmentButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch link token from backend
  const fetchLinkToken = async () => {
    setIsLoading(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'user-' + Date.now(),
          account_type: 'investment'
        })
      });
      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (error) {
      console.error('Error fetching link token:', error);
      alert('Failed to connect to Plaid. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle successful connection
  const onPlaidSuccess = useCallback(async (public_token: string) => {
    console.log('Investment account connected!');
    onSuccess(public_token);
  }, [onSuccess]);

  // Initialize Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
  });

  // Handle button click
  const handleClick = () => {
    if (linkToken) {
      open();
    } else {
      fetchLinkToken().then(() => {
        // Will open automatically once token is fetched
      });
    }
  };

  // Auto-open when token is ready
  if (linkToken && ready && !isLoading) {
    open();
    setLinkToken(null); // Prevent auto-opening again
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="flex items-center gap-2 px-6 py-3 btn-gradient disabled:bg-surface-elevated disabled:text-text-muted disabled:bg-none font-medium rounded-lg active:scale-[0.98]"
    >
      {isLoading ? (
        <>
          <Loader2 size={20} className="animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <BarChart3 size={20} />
          Connect Investment Account
        </>
      )}
    </button>
  );
}
