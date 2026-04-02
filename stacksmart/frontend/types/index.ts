export interface LoanData {
  loan_name: string;
  principal: number;
  interest_rate: number;
  minimum_payment: number;
}

export interface MarketAssumptions {
  expected_annual_return: number;
  volatility: number;
  risk_free_rate: number;
}

export interface MonthlyBreakdown {
  month: number;
  debt_path_net_worth: number;
  invest_path_net_worth: number;
  debt_path_loan_balance: number;
  invest_path_loan_balance: number;
  invest_path_portfolio_value: number;
}

export interface InvestmentAllocation {
  name: string;
  ticker: string;
  percentage: number;
  monthly_amount: number;
  description: string;
  risk_level: string;
}

export interface OptimizationResult {
  recommendation: string;
  net_worth_debt_path: number;
  net_worth_invest_path: number;
  monthly_breakdown: MonthlyBreakdown[];
  crossover_month: number | null;
  confidence_score: number;
  investment_allocations?: InvestmentAllocation[];
  investment_strategy?: string;
}

export interface OptimizationRequest {
  loan: LoanData;
  monthly_budget: number;
  months_until_graduation: number;
  market_assumptions: MarketAssumptions;
}

// ============= Multi-Loan Types =============

export type LoanType = 'student_loan' | 'car_loan' | 'credit_card' | 'personal_loan' | 'other';

export interface Loan {
  id: string;
  loan_type: LoanType;
  loan_name: string;
  principal: number;
  interest_rate: number;
  minimum_payment: number;
  term_months?: number;
}

export interface MultiLoanRequest {
  loans: Omit<Loan, 'id'>[];  // Backend doesn't need id
  monthly_budget: number;
  months_until_graduation: number;
  market_assumptions: MarketAssumptions;
}

export interface DebtPriority {
  loan_name: string;
  loan_type: string;
  priority: number;
  interest_rate: number;
  recommended_extra_payment: number;
  reason: string;
  guaranteed_return: number;
}

export interface MultiLoanResult {
  overall_recommendation: 'pay_debts' | 'invest';
  debt_priorities: DebtPriority[];
  investment_recommendation?: InvestmentAllocation[];
  net_worth_projection: {
    current: number;
    debt_path_1yr: number;
    debt_path_5yr: number;
    invest_path_1yr: number;
    invest_path_5yr: number;
    final_debt_path: number;
    final_invest_path: number;
  };
  reasoning: string[];
  confidence_score: number;
}
