'use client';

import { useState } from 'react';
import { OptimizationRequest } from '@/types';
import PlaidLinkButton from './PlaidLinkButton';
import { Loader2 } from 'lucide-react';

interface InputFormProps {
  onSubmit: (data: OptimizationRequest) => void;
  isLoading: boolean;
}

export default function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [formData, setFormData] = useState({
    loanName: 'Student Loan',
    principal: '25000',
    interestRate: '9.0',
    minimumPayment: '200',
    monthlyBudget: '100',
    monthsUntilGraduation: '48'
  });

  const handlePlaidSuccess = (suggestedAmount: number) => {
    setFormData({ ...formData, monthlyBudget: suggestedAmount.toString() });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const request: OptimizationRequest = {
      loan: {
        loan_name: formData.loanName,
        principal: parseFloat(formData.principal),
        interest_rate: parseFloat(formData.interestRate) / 100,
        minimum_payment: parseFloat(formData.minimumPayment)
      },
      monthly_budget: parseFloat(formData.monthlyBudget),
      months_until_graduation: parseInt(formData.monthsUntilGraduation),
      market_assumptions: {
        expected_annual_return: 0.10,
        volatility: 0.15,
        risk_free_rate: 0.04
      }
    };

    onSubmit(request);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface p-6 rounded-xl border border-border-subtle">
      <div className="text-center mb-4">
        <h2 className="text-lg font-semibold text-text-primary mb-1">Your Financial Snapshot</h2>
        <p className="text-text-muted text-xs">Enter your details to get personalized recommendations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Loan Principal ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.principal}
            onChange={(e) => setFormData({ ...formData, principal: e.target.value })}
            className="w-full px-3 py-2 bg-surface-elevated/60 border border-border-subtle rounded-lg text-text-primary text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            placeholder="25000"
            required
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Interest (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.interestRate}
            onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
            className="w-full px-3 py-2 bg-surface-elevated/60 border border-border-subtle rounded-lg text-text-primary text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            placeholder="9.0"
            required
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Min Payment/Mo ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.minimumPayment}
            onChange={(e) => setFormData({ ...formData, minimumPayment: e.target.value })}
            className="w-full px-3 py-2 bg-surface-elevated/60 border border-border-subtle rounded-lg text-text-primary text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            placeholder="200"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Spare Cash/Month ($)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={formData.monthlyBudget}
              onChange={(e) => setFormData({ ...formData, monthlyBudget: e.target.value })}
              className="flex-1 px-3 py-2 bg-surface-elevated/60 border border-border-subtle rounded-lg text-text-primary text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
              placeholder="100"
              required
            />
            <PlaidLinkButton onSuccess={handlePlaidSuccess} />
          </div>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Months Left
          </label>
          <input
            type="number"
            value={formData.monthsUntilGraduation}
            onChange={(e) => setFormData({ ...formData, monthsUntilGraduation: e.target.value })}
            className="w-full px-3 py-2 bg-surface-elevated/60 border border-border-subtle rounded-lg text-text-primary text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            placeholder="48"
            required
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 btn-gradient disabled:bg-surface-elevated disabled:text-text-muted disabled:bg-none disabled:cursor-not-allowed py-3 px-6 rounded-lg"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <Loader2 size={20} className="animate-spin mr-3" />
              Calculating...
            </span>
          ) : (
            'Optimize My Money'
          )}
        </button>
        <div className="px-4 py-3 bg-surface rounded-lg border border-border-subtle">
          <p className="text-xs text-text-muted whitespace-nowrap">
            Market: 10% S&P 500 avg
          </p>
        </div>
      </div>
    </form>
  );
}
