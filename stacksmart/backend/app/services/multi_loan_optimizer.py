"""
Multi-Loan Optimization Engine

Implements debt avalanche strategy (highest interest rate first) and
compares debt payoff vs investing across multiple loans.
"""

import numpy as np
from typing import List, Dict, Tuple
from app.models.schemas import (
    LoanData,
    MarketAssumptions,
    DebtRecommendation,
    MultiLoanOptimizationResult,
    InvestmentAllocation
)
from app.services.optimization_engine import generate_investment_allocations


def calculate_multi_loan_optimization(
    loans: List[LoanData],
    monthly_budget: float,
    market_assumptions: MarketAssumptions,
    months_until_graduation: int = 60  # Default to 5 years for projections
) -> MultiLoanOptimizationResult:
    """
    Smart debt prioritization using debt avalanche method.

    Algorithm:
    1. Sort loans by interest rate (highest first - debt avalanche)
    2. Compare highest interest rate vs expected market return
    3. If highest_rate > market_return: recommend paying debts
    4. If market_return >= highest_rate: recommend investing
    5. Always return priority list for all debts

    Note: months_until_graduation is only used for projections, not for the recommendation logic

    Args:
        loans: List of loan data
        monthly_budget: Total spare cash available per month
        market_assumptions: Expected market returns
        months_until_graduation: Timeline for projections only (default: 60 months)

    Returns:
        MultiLoanOptimizationResult with recommendations and priorities
    """

    # Sort loans by interest rate (descending) - Debt Avalanche
    sorted_loans = sorted(loans, key=lambda x: x.interest_rate, reverse=True)

    # Get highest interest rate
    highest_rate = sorted_loans[0].interest_rate
    market_return = market_assumptions.expected_annual_return

    # Core decision logic - ONLY based on interest rates vs market return
    # NOT affected by timeline
    if highest_rate > market_return:
        recommendation = "pay_debts"
        confidence_gap = highest_rate - market_return
    else:
        recommendation = "invest"
        confidence_gap = market_return - highest_rate

    # Calculate confidence score (0-1 scale)
    # Higher gap = higher confidence
    confidence_score = min(0.95, 0.5 + (confidence_gap / 0.20))

    # Generate debt priority list (avalanche method)
    debt_priorities = []

    for idx, loan in enumerate(sorted_loans):
        priority = idx + 1  # 1-indexed

        # Calculate recommended extra payment
        if recommendation == "pay_debts":
            # Allocate budget to highest priority debts
            if priority == 1:
                recommended_extra = monthly_budget
            else:
                # Lower priority debts get minimums (user can adjust later)
                recommended_extra = 0.0
        else:
            # If recommending invest, no extra payments
            recommended_extra = 0.0

        # Generate reasoning
        if priority == 1:
            reason = f"Highest interest rate ({loan.interest_rate * 100:.1f}%) - pay this first (debt avalanche method)"
        else:
            reason = f"{loan.interest_rate * 100:.1f}% interest - pay after Priority {priority - 1}"

        debt_priorities.append(
            DebtRecommendation(
                loan_name=loan.loan_name,
                loan_type=loan.loan_type.value,
                priority=priority,
                interest_rate=loan.interest_rate,
                recommended_extra_payment=recommended_extra,
                reason=reason,
                guaranteed_return=loan.interest_rate * 100  # Convert to percentage
            )
        )

    # Calculate net worth projections (for visualization only)
    projection_debt_path = calculate_debt_path_projection(
        sorted_loans,
        monthly_budget,
        months_until_graduation
    )

    projection_invest_path = calculate_invest_path_projection(
        sorted_loans,
        monthly_budget,
        market_return,
        months_until_graduation
    )

    net_worth_projection = {
        "current": projection_debt_path["current"],
        "debt_path_1yr": projection_debt_path["1yr"],
        "debt_path_5yr": projection_debt_path["5yr"],
        "invest_path_1yr": projection_invest_path["1yr"],
        "invest_path_5yr": projection_invest_path["5yr"],
        "final_debt_path": projection_debt_path["final"],
        "final_invest_path": projection_invest_path["final"]
    }

    # Generate investment recommendation if recommending invest
    # Use 70/20/10 aggressive allocation (not based on timeline)
    investment_recommendation = None
    if recommendation == "invest":
        investment_recommendation = [
            InvestmentAllocation(
                name="S&P 500 Index Fund",
                ticker="VOO",
                percentage=70.0,
                monthly_amount=round(monthly_budget * 0.70, 2),
                description="Tracks the 500 largest US companies. Historically ~10% annual return.",
                risk_level="medium"
            ),
            InvestmentAllocation(
                name="Total International Stock",
                ticker="VXUS",
                percentage=20.0,
                monthly_amount=round(monthly_budget * 0.20, 2),
                description="Diversification across non-US markets.",
                risk_level="medium"
            ),
            InvestmentAllocation(
                name="Bond Index Fund",
                ticker="BND",
                percentage=10.0,
                monthly_amount=round(monthly_budget * 0.10, 2),
                description="Stability during market downturns.",
                risk_level="low"
            )
        ]

    # Build reasoning
    reasoning = generate_reasoning(
        recommendation=recommendation,
        highest_rate=highest_rate,
        market_return=market_return,
        sorted_loans=sorted_loans,
        monthly_budget=monthly_budget
    )

    return MultiLoanOptimizationResult(
        overall_recommendation=recommendation,
        debt_priorities=debt_priorities,
        investment_recommendation=investment_recommendation,
        net_worth_projection=net_worth_projection,
        reasoning=reasoning,
        confidence_score=round(confidence_score, 3)
    )


def calculate_debt_path_projection(
    loans: List[LoanData],
    monthly_budget: float,
    months: int
) -> Dict[str, float]:
    """
    Calculate net worth projection when paying extra toward highest-interest debt.

    Uses debt avalanche: all extra payment goes to highest rate debt until paid off,
    then moves to next highest rate debt.
    """
    # Current net worth = -sum of all debts
    total_debt = sum(loan.principal for loan in loans)
    current_net_worth = -total_debt

    # Simulate debt payoff over time
    remaining_debts = [
        {
            "balance": loan.principal,
            "rate": loan.interest_rate,
            "min_payment": loan.minimum_payment
        }
        for loan in loans
    ]

    # Sort by interest rate (avalanche)
    remaining_debts.sort(key=lambda x: x["rate"], reverse=True)

    net_worth_1yr = simulate_debt_payoff(remaining_debts.copy(), monthly_budget, min(12, months))
    net_worth_5yr = simulate_debt_payoff(remaining_debts.copy(), monthly_budget, min(60, months))
    net_worth_final = simulate_debt_payoff(remaining_debts.copy(), monthly_budget, months)

    return {
        "current": current_net_worth,
        "1yr": net_worth_1yr,
        "5yr": net_worth_5yr,
        "final": net_worth_final
    }


def simulate_debt_payoff(debts: List[Dict], extra_budget: float, months: int) -> float:
    """Simulate debt payoff with avalanche method."""
    for month in range(months):
        if not debts:
            break

        # Pay minimums on all debts
        for debt in debts:
            if debt["balance"] <= 0:
                continue
            interest = debt["balance"] * (debt["rate"] / 12)
            principal_payment = max(0, debt["min_payment"] - interest)
            debt["balance"] -= principal_payment
            debt["balance"] = max(0, debt["balance"] + interest)

        # Apply extra payment to highest-rate debt
        if extra_budget > 0 and debts:
            target_debt = debts[0]  # Already sorted by rate
            if target_debt["balance"] > 0:
                target_debt["balance"] = max(0, target_debt["balance"] - extra_budget)

        # Remove paid-off debts
        debts = [d for d in debts if d["balance"] > 0.01]

    # Net worth = -remaining debt
    total_remaining = sum(d["balance"] for d in debts)
    return -total_remaining


def calculate_invest_path_projection(
    loans: List[LoanData],
    monthly_budget: float,
    market_return: float,
    months: int
) -> Dict[str, float]:
    """
    Calculate net worth projection when making minimum payments and investing.
    """
    # Current state
    total_debt = sum(loan.principal for loan in loans)
    current_net_worth = -total_debt

    # Simulate with minimum payments only
    debts = [
        {
            "balance": loan.principal,
            "rate": loan.interest_rate,
            "min_payment": loan.minimum_payment
        }
        for loan in loans
    ]

    # Calculate projections
    net_worth_1yr = simulate_invest_path(debts.copy(), monthly_budget, market_return, min(12, months))
    net_worth_5yr = simulate_invest_path(debts.copy(), monthly_budget, market_return, min(60, months))
    net_worth_final = simulate_invest_path(debts.copy(), monthly_budget, market_return, months)

    return {
        "current": current_net_worth,
        "1yr": net_worth_1yr,
        "5yr": net_worth_5yr,
        "final": net_worth_final
    }


def simulate_invest_path(debts: List[Dict], investment_budget: float, annual_return: float, months: int) -> float:
    """Simulate investing while making minimum debt payments."""
    monthly_return = annual_return / 12
    investment_value = 0.0

    for month in range(months):
        # Pay minimums on all debts
        for debt in debts:
            if debt["balance"] <= 0:
                continue
            interest = debt["balance"] * (debt["rate"] / 12)
            principal_payment = max(0, debt["min_payment"] - interest)
            debt["balance"] -= principal_payment
            debt["balance"] = max(0, debt["balance"] + interest)

        # Invest the budget
        investment_value += investment_budget
        investment_value *= (1 + monthly_return)

    # Net worth = investments - remaining debt
    total_debt = sum(d["balance"] for d in debts)
    return investment_value - total_debt


def generate_reasoning(
    recommendation: str,
    highest_rate: float,
    market_return: float,
    sorted_loans: List[LoanData],
    monthly_budget: float
) -> List[str]:
    """Generate clear reasoning for the recommendation."""
    reasoning = []

    if recommendation == "pay_debts":
        reasoning.append(
            f"Your highest interest debt is {highest_rate * 100:.1f}%, which is higher than the expected market return ({market_return * 100:.0f}%)"
        )
        reasoning.append(
            f"Paying off debt gives you a GUARANTEED {highest_rate * 100:.1f}% return (vs risky {market_return * 100:.0f}% from investing)"
        )
        reasoning.append(
            f"Use the debt avalanche method: focus ${monthly_budget:.0f}/month on your {sorted_loans[0].loan_name} first"
        )

        if len(sorted_loans) > 1:
            reasoning.append(
                f"After paying off {sorted_loans[0].loan_name}, move to {sorted_loans[1].loan_name} ({sorted_loans[1].interest_rate * 100:.1f}%)"
            )

    else:  # invest
        reasoning.append(
            f"Your highest interest debt is {highest_rate * 100:.1f}%, which is lower than the expected market return ({market_return * 100:.0f}%)"
        )
        reasoning.append(
            f"Historically, the S&P 500 (VOO) has returned ~10% annually over the long term"
        )
        reasoning.append(
            f"Invest ${monthly_budget:.0f}/month while making minimum payments on all debts"
        )
        reasoning.append(
            "Still recommended: pay off any debt above 10% interest rate when you have extra cash"
        )

    return reasoning
