import numpy as np
from typing import List, Tuple
from app.models.schemas import (
    LoanData,
    MarketAssumptions,
    OptimizationResult,
    MonthlyBreakdown,
    InvestmentAllocation
)


def calculate_loan_payoff_path(
    principal: float,
    annual_rate: float,
    monthly_payment: float,
    extra_payment: float,
    months: int
) -> Tuple[List[float], List[float]]:
    """
    Calculate remaining balance and total interest paid over time.
    Returns: (balances, cumulative_interest)
    """
    monthly_rate = annual_rate / 12
    balance = principal
    balances = []
    cumulative_interest = []
    total_interest = 0

    for month in range(months):
        if balance <= 0:
            balances.append(0)
            cumulative_interest.append(total_interest)
            continue

        # Calculate interest for this month
        interest_charge = balance * monthly_rate
        total_interest += interest_charge

        # Apply payment
        total_payment = monthly_payment + extra_payment
        principal_payment = total_payment - interest_charge

        balance = max(0, balance - principal_payment)

        balances.append(balance)
        cumulative_interest.append(total_interest)

    return balances, cumulative_interest


def calculate_investment_path(
    monthly_contribution: float,
    annual_return: float,
    months: int
) -> List[float]:
    """
    Calculate investment value over time with monthly contributions.
    Returns: List of investment values by month
    """
    monthly_return = annual_return / 12
    values = []
    current_value = 0

    for month in range(months):
        # Add contribution at start of month
        current_value += monthly_contribution
        # Apply monthly return
        current_value *= (1 + monthly_return)
        values.append(current_value)

    return values


def calculate_net_worth(
    investment_value: float,
    loan_balance: float
) -> float:
    """Net worth = Assets - Liabilities"""
    return investment_value - loan_balance


def generate_investment_allocations(
    monthly_budget: float,
    months_until_graduation: int,
    risk_tolerance: str = "moderate"
) -> Tuple[List[InvestmentAllocation], str]:
    """
    Generate investment allocation recommendations based on student profile.

    For college students with a 4-year horizon, we recommend:
    - Simple, low-cost index funds
    - Focus on diversification
    - Age-appropriate risk (higher equity allocation for younger investors)
    """

    allocations = []

    # Aggressive allocation for young investors (4-year+ horizon)
    if months_until_graduation >= 36:  # 3+ years
        allocations = [
            InvestmentAllocation(
                name="S&P 500 Index Fund",
                ticker="VOO or SPY",
                percentage=70.0,
                monthly_amount=round(monthly_budget * 0.70, 2),
                description="Tracks the 500 largest US companies. Historically ~10% annual return. Low expense ratio.",
                risk_level="medium"
            ),
            InvestmentAllocation(
                name="Total International Stock",
                ticker="VXUS",
                percentage=20.0,
                monthly_amount=round(monthly_budget * 0.20, 2),
                description="Diversification across non-US markets. Reduces US-specific risk.",
                risk_level="medium"
            ),
            InvestmentAllocation(
                name="Bond Index Fund",
                ticker="BND",
                percentage=10.0,
                monthly_amount=round(monthly_budget * 0.10, 2),
                description="Stability during market downturns. Lower return but reduces volatility.",
                risk_level="low"
            )
        ]
        strategy = "aggressive"

    # Moderate allocation for 2-3 year horizon
    elif months_until_graduation >= 24:  # 2-3 years
        allocations = [
            InvestmentAllocation(
                name="S&P 500 Index Fund",
                ticker="VOO or SPY",
                percentage=60.0,
                monthly_amount=round(monthly_budget * 0.60, 2),
                description="Tracks the 500 largest US companies. Historically ~10% annual return.",
                risk_level="medium"
            ),
            InvestmentAllocation(
                name="Total International Stock",
                ticker="VXUS",
                percentage=15.0,
                monthly_amount=round(monthly_budget * 0.15, 2),
                description="International diversification.",
                risk_level="medium"
            ),
            InvestmentAllocation(
                name="Bond Index Fund",
                ticker="BND",
                percentage=25.0,
                monthly_amount=round(monthly_budget * 0.25, 2),
                description="More stability as graduation approaches.",
                risk_level="low"
            )
        ]
        strategy = "moderate"

    # Conservative allocation for short horizon
    else:  # Less than 2 years
        allocations = [
            InvestmentAllocation(
                name="S&P 500 Index Fund",
                ticker="VOO or SPY",
                percentage=40.0,
                monthly_amount=round(monthly_budget * 0.40, 2),
                description="Limited stock exposure for short timeline.",
                risk_level="medium"
            ),
            InvestmentAllocation(
                name="Bond Index Fund",
                ticker="BND",
                percentage=40.0,
                monthly_amount=round(monthly_budget * 0.40, 2),
                description="Capital preservation as graduation nears.",
                risk_level="low"
            ),
            InvestmentAllocation(
                name="High-Yield Savings",
                ticker="HYSA",
                percentage=20.0,
                monthly_amount=round(monthly_budget * 0.20, 2),
                description="Emergency fund / immediate liquidity. ~4-5% APY.",
                risk_level="low"
            )
        ]
        strategy = "conservative"

    return allocations, strategy


def calculate_optimization_path(
    loan_data: LoanData,
    market_assumptions: MarketAssumptions,
    monthly_budget: float,
    months_until_graduation: int = 48
) -> OptimizationResult:
    """
    Core optimization engine.
    Compares two scenarios and recommends the optimal path.
    """

    # Scenario A: Pay Extra Toward Debt
    debt_balances, debt_interest = calculate_loan_payoff_path(
        principal=loan_data.principal,
        annual_rate=loan_data.interest_rate,
        monthly_payment=loan_data.minimum_payment,
        extra_payment=monthly_budget,  # All spare cash to debt
        months=months_until_graduation
    )

    # In debt scenario, no investment happens
    debt_investment_values = [0] * months_until_graduation

    # Scenario B: Invest Spare Cash
    invest_balances, invest_interest = calculate_loan_payoff_path(
        principal=loan_data.principal,
        annual_rate=loan_data.interest_rate,
        monthly_payment=loan_data.minimum_payment,
        extra_payment=0,  # Only minimum payment
        months=months_until_graduation
    )

    invest_values = calculate_investment_path(
        monthly_contribution=monthly_budget,
        annual_return=market_assumptions.expected_annual_return,
        months=months_until_graduation
    )

    # Calculate net worth paths
    net_worth_debt = [
        calculate_net_worth(inv, debt)
        for inv, debt in zip(debt_investment_values, debt_balances)
    ]

    net_worth_invest = [
        calculate_net_worth(inv, debt)
        for inv, debt in zip(invest_values, invest_balances)
    ]

    # Final net worth at graduation
    final_debt_path = net_worth_debt[-1]
    final_invest_path = net_worth_invest[-1]

    # Determine recommendation
    recommendation = "pay_debt" if final_debt_path > final_invest_path else "invest"

    # Calculate confidence based on the gap
    gap = abs(final_debt_path - final_invest_path)
    # Confidence increases with larger gap (normalized)
    max_value = max(abs(final_debt_path), abs(final_invest_path))
    confidence = min(1.0, gap / (max_value + 1)) if max_value > 0 else 0.5

    # Find crossover point (if any)
    crossover_month = None
    for i in range(1, len(net_worth_debt)):
        if (net_worth_debt[i-1] <= net_worth_invest[i-1] and
            net_worth_debt[i] > net_worth_invest[i]):
            crossover_month = i
            break

    # Build monthly breakdown for visualization
    monthly_breakdown = []
    for i in range(months_until_graduation):
        monthly_breakdown.append(
            MonthlyBreakdown(
                month=i + 1,
                debt_path_net_worth=round(net_worth_debt[i], 2),
                invest_path_net_worth=round(net_worth_invest[i], 2),
                debt_path_loan_balance=round(debt_balances[i], 2),
                invest_path_loan_balance=round(invest_balances[i], 2),
                invest_path_portfolio_value=round(invest_values[i], 2)
            )
        )

    # Generate investment allocations if recommendation is to invest
    investment_allocations = None
    investment_strategy = None
    if recommendation == "invest":
        investment_allocations, investment_strategy = generate_investment_allocations(
            monthly_budget=monthly_budget,
            months_until_graduation=months_until_graduation
        )

    return OptimizationResult(
        recommendation=recommendation,
        net_worth_debt_path=round(final_debt_path, 2),
        net_worth_invest_path=round(final_invest_path, 2),
        monthly_breakdown=monthly_breakdown,
        crossover_month=crossover_month,
        confidence_score=round(confidence, 3),
        investment_allocations=investment_allocations,
        investment_strategy=investment_strategy
    )
