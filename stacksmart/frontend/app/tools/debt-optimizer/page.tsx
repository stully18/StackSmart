'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, CreditCard, TrendingUp, Rocket, BarChart3, Check } from 'lucide-react';
import type { Loan, LoanType, MultiLoanRequest, MultiLoanResult, MarketAssumptions } from '@/types';
import { useFinancialData } from '../../context/FinancialContext';
import { useAuth } from '../../context/AuthContext';

interface VooMarketData {
  ticker: string;
  price: number;
  change_percent_today: number;
  ytd_return: number | null;
  one_year_return: number | null;
  five_year_avg_return: number;
  data_source: string;
  last_updated: string;
  error?: string;
}

export default function DebtOptimizerPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { financialData, updateFinancialData } = useFinancialData();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<string>(financialData.monthlyBudget.toString());
  const [result, setResult] = useState<MultiLoanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vooData, setVooData] = useState<VooMarketData | null>(null);
  const [marketDataLoading, setMarketDataLoading] = useState(false);

  // Redirect to login only AFTER auth finishes loading and there's truly no user
  useEffect(() => {
    if (authLoading === false && user === null) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Sync monthly budget to context when it changes
  useEffect(() => {
    const budget = parseFloat(monthlyBudget);
    if (!isNaN(budget) && budget > 0) {
      updateFinancialData({ monthlyBudget: budget });
    }
  }, [monthlyBudget]);

  // Update total debt in context when loans change
  useEffect(() => {
    const totalDebt = loans.reduce((sum, loan) => sum + loan.principal, 0);
    updateFinancialData({ totalDebt });
  }, [loans]);

  const addLoan = () => {
    const newLoan: Loan = {
      id: `loan-${Date.now()}`,
      loan_type: 'student_loan',
      loan_name: `Loan ${loans.length + 1}`,
      principal: 0,
      interest_rate: 0,
      minimum_payment: 0,
      term_months: 120
    };
    setLoans([...loans, newLoan]);
  };

  const removeLoan = (id: string) => {
    setLoans(loans.filter(l => l.id !== id));
  };

  const updateLoan = (id: string, field: keyof Loan, value: any) => {
    setLoans(loans.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleOptimize = async () => {
    if (loans.length === 0) {
      setError('Please add at least one loan');
      return;
    }

    if (!monthlyBudget || parseFloat(monthlyBudget) <= 0) {
      setError('Please enter monthly spare cash');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const marketAssumptions: MarketAssumptions = {
        expected_annual_return: 0.10,
        volatility: 0.15,
        risk_free_rate: 0.04
      };

      const request: MultiLoanRequest = {
        loans: loans.map(({ id, ...loan }) => ({
          ...loan,
          interest_rate: loan.interest_rate / 100  // Convert percentage to decimal
        })),
        monthly_budget: parseFloat(monthlyBudget),
        months_until_graduation: 60,  // Default to 5 years for projections (not used in recommendation logic)
        market_assumptions: marketAssumptions
      };

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;
      const response = await fetch(`${API_BASE_URL}/api/optimize-multi-loan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Optimization failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to optimize');
    } finally {
      setIsLoading(false);
    }
  };

  const getLoanTypeLabel = (type: LoanType): string => {
    const labels = {
      student_loan: 'Student Loan',
      car_loan: 'Car Loan',
      credit_card: 'Credit Card',
      personal_loan: 'Personal Loan',
      other: 'Other'
    };
    return labels[type];
  };

  // Fetch live market data on component mount
  useEffect(() => {
    const fetchMarketData = async () => {
      setMarketDataLoading(true);
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;
        const response = await fetch(`${API_BASE_URL}/api/market/voo-live`);
        if (response.ok) {
          const data = await response.json();
          setVooData(data);
        }
      } catch (err) {
        console.error('Failed to fetch market data:', err);
      } finally {
        setMarketDataLoading(false);
      }
    };

    fetchMarketData();
  }, []);

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

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight text-text-primary mb-2">
            Debt Optimizer
          </h1>
          <p className="text-text-muted">Add your loans and see which debts to pay first vs investing</p>

          {/* Live Market Data */}
          {vooData && !vooData.error && (
            <div className="mt-4 p-4 bg-surface border border-border-subtle rounded-xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">Live Market Data:</span>
                  <span className="font-semibold text-text-primary">VOO ${vooData.price.toFixed(2)}</span>
                  <span className={`text-sm font-semibold ${vooData.change_percent_today >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {vooData.change_percent_today >= 0 ? '↑' : '↓'} {Math.abs(vooData.change_percent_today).toFixed(2)}% today
                  </span>
                </div>
                <div className="flex gap-6 text-sm">
                  {vooData.ytd_return !== null && (
                    <div>
                      <span className="text-text-muted">YTD: </span>
                      <span className={vooData.ytd_return >= 0 ? 'text-success' : 'text-destructive'}>
                        {vooData.ytd_return >= 0 ? '+' : ''}{vooData.ytd_return.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {vooData.one_year_return !== null && (
                    <div>
                      <span className="text-text-muted">1-Year: </span>
                      <span className={vooData.one_year_return >= 0 ? 'text-success' : 'text-destructive'}>
                        {vooData.one_year_return >= 0 ? '+' : ''}{vooData.one_year_return.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-text-muted">Historical Avg: </span>
                    <span className="text-primary">~{vooData.five_year_avg_return.toFixed(0)}%/yr</span>
                  </div>
                </div>
                <div className="text-xs text-text-muted/70">
                  Source: {vooData.data_source}
                </div>
              </div>
            </div>
          )}
          {marketDataLoading && (
            <div className="mt-4 p-4 bg-surface border border-border-subtle rounded-xl text-center text-text-muted">
              Loading market data...
            </div>
          )}
        </div>

        {/* Loan Input Section */}
        <div className="bg-surface border border-border-subtle rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Your Loans</h2>
            <button
              onClick={addLoan}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-[#0f2a00] rounded-lg transition-colors font-semibold text-sm active:scale-[0.98]"
            >
              + Add Loan
            </button>
          </div>

          {loans.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex justify-center mb-4"><FileText size={48} className="text-text-muted" /></div>
              <p className="text-xl text-text-secondary mb-2">No loans added yet</p>
              <p className="text-sm text-text-muted mb-6">Click "Add Loan" above to get started</p>

              <div className="max-w-2xl mx-auto text-left bg-surface-elevated/50 border border-border-subtle rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-3 text-primary">Quick Tips:</h3>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li>Add all your debts: student loans, credit cards, car loans, etc.</li>
                  <li>You'll need: total balance, interest rate (APR), and monthly payment</li>
                  <li>Enter your monthly spare cash (money left after all bills/expenses)</li>
                  <li>We'll tell you which debt to tackle first vs investing in the market</li>
                </ul>

                <div className="mt-4 pt-4 border-t border-border-subtle">
                  <p className="text-xs text-text-muted">
                    <strong className="text-text-secondary">Example:</strong> Credit card at 18% APR, Student loan at 6% APR -
                    We'll recommend paying the credit card first (18% guaranteed return beats market's 10%)
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {loans.map((loan) => (
                <div key={loan.id} className="bg-surface-elevated/30 border border-border-subtle rounded-xl p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-text-muted mb-1">Loan Type</label>
                      <select
                        value={loan.loan_type}
                        onChange={(e) => updateLoan(loan.id, 'loan_type', e.target.value as LoanType)}
                        className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      >
                        <option value="student_loan">Student Loan</option>
                        <option value="car_loan">Car Loan</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="personal_loan">Personal Loan</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-text-muted mb-1">Loan Name</label>
                      <input
                        type="text"
                        value={loan.loan_name}
                        onChange={(e) => updateLoan(loan.id, 'loan_name', e.target.value)}
                        className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                        placeholder="e.g., Chase Credit Card"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-text-muted mb-1">Amount Owed ($)</label>
                      <input
                        type="number"
                        value={loan.principal || ''}
                        onChange={(e) => updateLoan(loan.id, 'principal', parseFloat(e.target.value) || 0)}
                        className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                        placeholder="25000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-text-muted mb-1">Interest Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={loan.interest_rate || ''}
                        onChange={(e) => updateLoan(loan.id, 'interest_rate', parseFloat(e.target.value) || 0)}
                        className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                        placeholder="7.5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-text-muted mb-1">Monthly Payment ($)</label>
                      <input
                        type="number"
                        value={loan.minimum_payment || ''}
                        onChange={(e) => updateLoan(loan.id, 'minimum_payment', parseFloat(e.target.value) || 0)}
                        className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                        placeholder="200"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => removeLoan(loan.id)}
                        className="w-full px-4 py-2 bg-surface-elevated hover:bg-destructive/20 border border-border hover:border-destructive/50 text-text-secondary hover:text-destructive rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Budget Input */}
          <div className="mt-6 pt-6 border-t border-border-subtle">
            <div>
              <label className="block text-sm text-text-muted mb-1">Monthly Spare Cash ($)</label>
              <input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                placeholder="100"
              />
              <p className="text-xs text-text-muted/70 mt-1">Extra money you have each month after paying all minimums and expenses</p>
            </div>
          </div>

          <button
            onClick={handleOptimize}
            disabled={isLoading || loans.length === 0}
            className="w-full mt-6 px-6 py-3 btn-gradient disabled:bg-surface-elevated disabled:text-text-muted disabled:bg-none rounded-lg font-semibold text-lg flex items-center justify-center gap-2"
          >
            {isLoading && (
              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {isLoading ? 'Optimizing...' : 'Optimize My Money'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-surface border-l-4 border-destructive rounded text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-6">
            {/* Recommendation Card */}
            <div className={`border-l-4 rounded-xl p-6 bg-surface border-t border-r border-b border-t-border-subtle border-r-border-subtle border-b-border-subtle ${
              result.overall_recommendation === 'pay_debts'
                ? 'border-l-destructive'
                : 'border-l-success'
            }`}>
              <div className="text-center mb-4">
                <div className="flex justify-center mb-2">
                  {result.overall_recommendation === 'pay_debts' ? <CreditCard size={48} className="text-destructive" /> : <TrendingUp size={48} className="text-success" />}
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-text-primary mb-2">
                  {result.overall_recommendation === 'pay_debts' ? 'Pay Off Debt First' : 'Start Investing'}
                </h2>
                <div className="text-sm text-text-muted">
                  Confidence: {(result.confidence_score * 100).toFixed(0)}%
                </div>
              </div>

              <div className="bg-surface-elevated/50 rounded-lg p-4">
                <h3 className="font-semibold text-text-primary mb-2">Why?</h3>
                <ul className="space-y-1 text-sm">
                  {result.reasoning.map((reason, idx) => (
                    <li key={idx} className="text-text-secondary flex items-start gap-2">
                      <Check size={14} className="text-primary mt-0.5" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Debt Priority List - Only show if they have debts */}
            {result.debt_priorities.length > 0 && (
              <div className="bg-surface border border-border-subtle rounded-xl p-6">
                <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-4">Debt Payoff Priority</h2>
                <p className="text-text-muted text-sm mb-4">Using the avalanche method (highest interest first)</p>
                <div className="space-y-3">
                  {result.debt_priorities.map((debt) => (
                    <div
                      key={debt.priority}
                      className={`border rounded-xl p-4 ${
                        debt.priority === 1
                          ? 'bg-surface-elevated/50 border-warning/50'
                          : 'bg-surface-elevated/30 border-border-subtle'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              debt.priority === 1
                                ? 'bg-warning/20 text-warning border border-warning/30'
                                : 'bg-surface-elevated text-text-secondary border border-border'
                            }`}>
                              #{debt.priority}
                            </span>
                            <span className="font-semibold text-text-primary">{debt.loan_name}</span>
                            <span className="text-sm text-text-muted">({getLoanTypeLabel(debt.loan_type as LoanType)})</span>
                          </div>
                          <div className="text-sm text-text-secondary">{debt.reason}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-destructive">{debt.guaranteed_return.toFixed(1)}%</div>
                          <div className="text-xs text-text-muted">Interest Rate</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA to Personalized Plan */}
            <div className="bg-surface border border-border-subtle rounded-xl p-8">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  {result.overall_recommendation === 'invest' ? <Rocket size={40} className="text-primary" /> : <BarChart3 size={40} className="text-primary" />}
                </div>
                <h3 className="text-2xl font-semibold tracking-tight text-text-primary mb-3">
                  {result.overall_recommendation === 'invest'
                    ? "Now Let's Build Your Investment Plan"
                    : "Plan Your Investment Strategy"}
                </h3>
                <p className="text-text-secondary mb-6 max-w-lg mx-auto">
                  {result.overall_recommendation === 'invest'
                    ? "Get a personalized portfolio with ETF allocations and see your projected wealth growth over 10, 20, and 30 years."
                    : "Once your high-interest debt is paid off, you'll want an investment plan ready. Set one up now based on your risk tolerance."}
                </p>
                <button
                  onClick={() => router.push('/tools/investment-plan')}
                  className="px-8 py-4 btn-gradient rounded-lg font-semibold text-lg"
                >
                  Create My Investment Plan
                </button>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="p-3 bg-surface border-l-4 border-warning rounded text-sm text-text-secondary text-center">
              <strong className="text-warning">Note:</strong> This provides mathematical guidance, not financial advice. Consider your emergency fund and personal situation.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
