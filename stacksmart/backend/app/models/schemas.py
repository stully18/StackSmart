from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class LoanType(str, Enum):
    STUDENT_LOAN = "student_loan"
    CAR_LOAN = "car_loan"
    CREDIT_CARD = "credit_card"
    PERSONAL_LOAN = "personal_loan"
    OTHER = "other"


class LoanData(BaseModel):
    loan_type: LoanType = Field(default=LoanType.STUDENT_LOAN, description="Type of loan")
    loan_name: str = Field(default="Student Loan", description="Name of the loan")
    principal: float = Field(..., gt=0, description="Loan principal amount / amount owed")
    interest_rate: float = Field(..., ge=0, le=1, description="Annual interest rate as decimal (e.g., 0.09)")
    minimum_payment: float = Field(..., gt=0, description="Minimum monthly payment")
    term_months: Optional[int] = Field(default=None, gt=0, description="Loan term in months (optional)")


class MarketAssumptions(BaseModel):
    expected_annual_return: float = Field(default=0.10, ge=0, le=1, description="Expected annual return as decimal")
    volatility: float = Field(default=0.15, ge=0, le=1, description="Standard deviation of returns")
    risk_free_rate: float = Field(default=0.04, ge=0, le=1, description="Risk-free rate")


class MonthlyBreakdown(BaseModel):
    month: int
    debt_path_net_worth: float
    invest_path_net_worth: float
    debt_path_loan_balance: float
    invest_path_loan_balance: float
    invest_path_portfolio_value: float


class InvestmentAllocation(BaseModel):
    name: str
    ticker: str
    percentage: float
    monthly_amount: float
    description: str
    risk_level: str  # 'low', 'medium', 'high'


class OptimizationResult(BaseModel):
    recommendation: str  # 'pay_debt' or 'invest'
    net_worth_debt_path: float
    net_worth_invest_path: float
    monthly_breakdown: List[MonthlyBreakdown]
    crossover_month: Optional[int] = None
    confidence_score: float
    investment_allocations: Optional[List[InvestmentAllocation]] = None
    investment_strategy: Optional[str] = None


class OptimizationRequest(BaseModel):
    loan: LoanData
    monthly_budget: float = Field(..., gt=0, description="Monthly spare cash available")
    months_until_graduation: int = Field(default=48, gt=0, le=120, description="Months until graduation")
    market_assumptions: MarketAssumptions = Field(default_factory=MarketAssumptions)


# ============= Multi-Loan Models =============

class DebtRecommendation(BaseModel):
    loan_name: str
    loan_type: str
    priority: int  # 1 = highest priority
    interest_rate: float  # Annual rate as decimal
    recommended_extra_payment: float
    reason: str
    guaranteed_return: float  # Interest rate shown as guaranteed return percentage


class MultiLoanOptimizationRequest(BaseModel):
    loans: List[LoanData] = Field(..., min_length=1, description="List of all loans")
    monthly_budget: float = Field(..., gt=0, description="Total spare cash per month")
    months_until_graduation: int = Field(default=60, gt=0, le=120, description="Timeline for projections only (default: 60 months = 5 years)")
    market_assumptions: MarketAssumptions = Field(default_factory=MarketAssumptions)


class MultiLoanOptimizationResult(BaseModel):
    overall_recommendation: str  # "pay_debts" or "invest"
    debt_priorities: List[DebtRecommendation]  # Ordered by priority
    investment_recommendation: Optional[List[InvestmentAllocation]] = None
    net_worth_projection: dict
    reasoning: List[str]
    confidence_score: float


# ============= Personalized Financial Plan Models =============

class RiskTolerance(str, Enum):
    CONSERVATIVE = "conservative"  # Low risk, stable returns
    MODERATE = "moderate"  # Balanced risk/reward
    AGGRESSIVE = "aggressive"  # High risk, high potential returns

class FinancialGoal(str, Enum):
    WEALTH_BUILDING = "wealth_building"  # Long-term growth
    INCOME_GENERATION = "income_generation"  # Dividend income
    CAPITAL_PRESERVATION = "capital_preservation"  # Protect what you have
    DEBT_FREEDOM = "debt_freedom"  # Eliminate debt first

class ETFAllocation(BaseModel):
    ticker: str
    name: str
    category: str  # "US Stocks", "International Stocks", "Bonds", "REITs", etc.
    percentage: float
    monthly_amount: float
    current_price: float
    ytd_return: Optional[float] = None
    one_year_return: Optional[float] = None
    expense_ratio: float
    description: str
    risk_level: str

class PersonalizedPlanRequest(BaseModel):
    monthly_investment_amount: float = Field(..., gt=0, description="Amount available to invest monthly")
    risk_tolerance: RiskTolerance = Field(default=RiskTolerance.MODERATE, description="Risk tolerance level")
    financial_goal: FinancialGoal = Field(default=FinancialGoal.WEALTH_BUILDING, description="Primary financial goal")
    time_horizon_years: int = Field(default=10, gt=0, le=50, description="Investment time horizon in years")
    current_savings: float = Field(default=0.0, ge=0, description="Current savings/investment balance")
    has_emergency_fund: bool = Field(default=False, description="Whether user has 3-6 months emergency fund")
    # Paycheck allocation fields (all optional — enables waterfall mode when monthly_gross_income is set)
    monthly_gross_income: Optional[float] = Field(default=None, ge=0, description="Monthly gross income (enables paycheck allocation mode)")
    monthly_expenses: Optional[float] = Field(default=None, ge=0, description="Monthly living expenses for emergency fund target calculation")
    employer_401k_match_percent: Optional[float] = Field(default=None, ge=0, le=100, description="Employer matches up to X% of salary (e.g. 5 = 5%)")
    include_roth_ira: bool = Field(default=False, description="Allocate to Roth IRA before brokerage")
    current_emergency_fund: float = Field(default=0.0, ge=0, description="Current emergency fund balance")
    emergency_fund_months_target: int = Field(default=3, ge=1, le=12, description="Target months of expenses in emergency fund")

class PersonalizedPlanResult(BaseModel):
    portfolio_name: str
    risk_profile: str
    target_allocation: List[ETFAllocation]
    monthly_investment_breakdown: dict
    projected_value_1yr: float
    projected_value_5yr: float
    projected_value_10yr: float
    projected_value_20yr: float
    projected_value_30yr: float
    expected_annual_return: float
    portfolio_expense_ratio: float
    rebalancing_frequency: str
    reasoning: List[str]
    next_steps: List[str]
    warnings: Optional[List[str]] = None
    paycheck_breakdown: Optional[dict] = None
    months_to_emergency_fund: Optional[int] = None
