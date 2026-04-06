'use client';

import { useCallback, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { CreditCard, Loader2 } from 'lucide-react';
import { ErrorAlert } from '@/app/components/Alerts';

interface PlaidLinkButtonProps {
  onSuccess: (balance: number) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is not set');
}

export default function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch link token from backend
  const fetchLinkToken = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'user-' + Date.now() })
      });
      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (error) {
      console.error('Error fetching link token:', error);
      setError('Failed to connect to Plaid. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle successful connection
  const onPlaidSuccess = useCallback(async (public_token: string) => {
    try {
      console.log('Exchanging public token...');
      // Exchange public token for access token
      const exchangeResponse = await fetch(`${API_BASE_URL}/api/plaid/exchange-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token })
      });

      if (!exchangeResponse.ok) {
        throw new Error(`Exchange failed: ${exchangeResponse.status}`);
      }

      const exchangeData = await exchangeResponse.json();
      console.log('Token exchanged successfully:', exchangeData);

      if (!exchangeData.access_token) {
        console.error('No access_token in response:', exchangeData);
        throw new Error('No access token received from server');
      }

      const { access_token } = exchangeData;

      console.log('Fetching account balance...');
      // Fetch account balance
      const balanceResponse = await fetch(`${API_BASE_URL}/api/plaid/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token })
      });

      if (!balanceResponse.ok) {
        const errorText = await balanceResponse.text();
        console.error('Balance fetch error:', errorText);
        throw new Error(`Balance fetch failed: ${balanceResponse.status} - ${errorText}`);
      }

      const balanceData = await balanceResponse.json();
      console.log('Balance data:', balanceData);

      if (!balanceData.total_balance && balanceData.total_balance !== 0) {
        console.error('No total_balance in response:', balanceData);
      }

      // Calculate suggested spare cash (25% of total balance)
      const totalBalance = balanceData.total_balance || 0;
      const suggestedSpare = Math.round(totalBalance * 0.25);

      console.log(`Total balance: $${totalBalance}, Suggested spare: $${suggestedSpare}`);
      onSuccess(suggestedSpare);
    } catch (error) {
      console.error('Error processing bank connection:', error);
      setError('Connected successfully, but couldn\'t fetch balance. Please enter manually.');
    }
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
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-surface-elevated hover:bg-surface-elevated/80 border border-border hover:border-primary/40 disabled:bg-surface-elevated disabled:text-text-muted text-text-primary text-sm font-medium rounded-lg transition-all"
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <CreditCard size={16} />
            Connect Bank
          </>
        )}
      </button>
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
    </>
  );
}
