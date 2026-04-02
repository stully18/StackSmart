'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FinancialData {
  monthlyBudget: number;
  currentSavings: number;
  totalDebt: number;
  hasEmergencyFund: boolean;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  financialGoal: 'wealth_building' | 'income_generation' | 'capital_preservation' | 'debt_freedom';
  timeHorizon: number;
}

interface FinancialContextType {
  financialData: FinancialData;
  updateFinancialData: (data: Partial<FinancialData>) => void;
}

const defaultFinancialData: FinancialData = {
  monthlyBudget: 500,
  currentSavings: 5000,
  totalDebt: 0,
  hasEmergencyFund: true,
  riskTolerance: 'moderate',
  financialGoal: 'wealth_building',
  timeHorizon: 10,
};

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export function FinancialProvider({ children }: { children: ReactNode }) {
  const [financialData, setFinancialData] = useState<FinancialData>(defaultFinancialData);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('financialData');
    if (saved) {
      try {
        setFinancialData(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load financial data:', e);
      }
    }
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem('financialData', JSON.stringify(financialData));
  }, [financialData]);

  const updateFinancialData = (data: Partial<FinancialData>) => {
    setFinancialData(prev => ({ ...prev, ...data }));
  };

  return (
    <FinancialContext.Provider value={{ financialData, updateFinancialData }}>
      {children}
    </FinancialContext.Provider>
  );
}

export function useFinancialData() {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancialData must be used within a FinancialProvider');
  }
  return context;
}
