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

// ============= Persisted User Loans (Supabase `public.user_loans`) =============

// A single row in the `user_loans` table. `interest_rate_percent` is the
// UI-entered percentage value (e.g. 7.5), NOT a decimal.
export interface UserLoanRow {
  id: string;
  user_id: string;
  loan_type: LoanType;
  loan_name: string;
  principal: number;
  interest_rate_percent: number;
  minimum_payment: number;
  term_months: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Insert/update payload (server-managed timestamps excluded).
export type UserLoanUpsert = Omit<UserLoanRow, 'created_at' | 'updated_at'>;

// ============= App Event Logging =============

// Whitelist of known event types recorded in `public.app_events`.
// Mirrors the SQL check constraint on `app_events.event_type`.
export type AppEventType =
  | 'account_created'
  | 'sign_in'
  | 'sign_out'
  | 'loan_added'
  | 'loan_removed'
  | 'loan_saved'
  | 'report_spawned'
  | 'report_generated'
  | 'feedback_submitted';

// Payload for the `add_user_loan` RPC. Same shape as a UI `Loan` minus the
// server-assigned `id`, with an optional `sort_order`. `interest_rate` is the
// UI percentage (e.g. 7.5), which the RPC stores as `interest_rate_percent`.
export type AddUserLoanInput = Omit<Loan, 'id'> & {
  sort_order?: number | null;
};

export interface DebtPriority {
  loan_name: string;
  loan_type: string;
  priority: number;
  interest_rate: number;
  recommended_extra_payment: number;
  reason: string;
  guaranteed_return: number;
}

export interface PersonalizedPlanGenerationStatus {
  limit: number;
  used_today: boolean;
  generation: null | {
    id: string;
    generated_on: string;
    status: 'pending' | 'completed' | 'failed';
    provider: string;
    model: string;
    created_at: string;
    completed_at: string | null;
  };
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
