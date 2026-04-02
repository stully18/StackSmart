"""
Personalized Financial Plan Generator

Creates customized investment portfolios based on:
- Risk tolerance (conservative, moderate, aggressive)
- Financial goals (wealth building, income, capital preservation, debt freedom)
- Time horizon
- Current financial situation

Uses real market data to show actual ETF performance and build realistic portfolios.
"""

from typing import List, Dict, Optional
import math
from app.models.schemas import (
    PersonalizedPlanRequest,
    PersonalizedPlanResult,
    ETFAllocation,
    RiskTolerance,
    FinancialGoal
)
from app.services import market_data_fetcher


# Portfolio templates based on risk tolerance
PORTFOLIO_TEMPLATES = {
    RiskTolerance.CONSERVATIVE: {
        "name": "Conservative Growth Portfolio",
        "description": "Focuses on stability and capital preservation with modest growth",
        "allocation": {
            "VOO": 30,  # US Large Cap
            "BND": 50,  # US Bonds
            "VXUS": 10,  # International
            "AGG": 10   # Additional bonds for stability
        },
        "expected_return": 0.06,  # 6% annually
        "rebalance": "Quarterly"
    },
    RiskTolerance.MODERATE: {
        "name": "Balanced Growth Portfolio",
        "description": "Balanced mix of growth and stability for long-term wealth building",
        "allocation": {
            "VOO": 50,   # US Large Cap
            "VXUS": 20,  # International
            "BND": 25,   # Bonds
            "VNQ": 5     # Real Estate for diversification
        },
        "expected_return": 0.08,  # 8% annually
        "rebalance": "Quarterly"
    },
    RiskTolerance.AGGRESSIVE: {
        "name": "Aggressive Growth Portfolio",
        "description": "Maximum growth potential with higher volatility",
        "allocation": {
            "VOO": 50,   # US Large Cap
            "QQQ": 20,   # Tech-heavy growth
            "VXUS": 15,  # International
            "VWO": 10,   # Emerging markets
            "BND": 5     # Small bond position
        },
        "expected_return": 0.10,  # 10% annually
        "rebalance": "Semi-annually"
    }
}

# Goal-based adjustments
GOAL_ADJUSTMENTS = {
    FinancialGoal.WEALTH_BUILDING: {
        "description": "Focus on long-term capital appreciation",
        "adjustments": {}  # Use base allocation
    },
    FinancialGoal.INCOME_GENERATION: {
        "description": "Emphasize dividend-paying investments",
        "adjustments": {
            "BND": +10,  # More bonds for income
            "VNQ": +5,   # REITs for dividends
            "VOO": -15   # Less growth stocks
        }
    },
    FinancialGoal.CAPITAL_PRESERVATION: {
        "description": "Protect existing wealth with minimal risk",
        "adjustments": {
            "BND": +20,   # Much more bonds
            "AGG": +10,   # Additional bond diversification
            "VOO": -20,   # Less stocks
            "VXUS": -10
        }
    },
    FinancialGoal.DEBT_FREEDOM: {
        "description": "Build emergency fund while minimizing investment risk",
        "adjustments": {
            "BND": +15,  # More stable investments
            "VOO": -10,  # Less equity exposure
            "VXUS": -5
        }
    }
}


ROTH_IRA_ANNUAL_LIMIT = 7000.0  # 2025 contribution limit


def calculate_paycheck_allocation(request: PersonalizedPlanRequest) -> Optional[Dict]:
    """
    Waterfall algorithm to split monthly savings budget across account types.
    Priority order: emergency fund → 401k to match → Roth IRA → brokerage

    Returns a breakdown dict, or None if paycheck mode is not enabled.
    """
    if request.monthly_gross_income is None:
        return None

    budget = request.monthly_investment_amount
    remaining = budget

    # 1. Emergency fund
    emergency_monthly = 0.0
    months_to_goal = None
    if request.monthly_expenses is not None:
        target = request.monthly_expenses * request.emergency_fund_months_target
        gap = max(0.0, target - request.current_emergency_fund)
        if gap > 0:
            # Fill the gap over at most 6 months
            emergency_monthly = min(gap / 6, remaining)
            months_to_goal = math.ceil(gap / emergency_monthly) if emergency_monthly > 0 else None
            remaining = max(0.0, remaining - emergency_monthly)
    else:
        target = 0.0

    # 2. 401k up to employer match
    contribution_401k = 0.0
    employer_match_401k = 0.0
    if request.employer_401k_match_percent is not None and request.employer_401k_match_percent > 0:
        match_threshold = request.monthly_gross_income * (request.employer_401k_match_percent / 100)
        contribution_401k = min(match_threshold, remaining)
        employer_match_401k = contribution_401k  # employer matches dollar-for-dollar up to threshold
        remaining = max(0.0, remaining - contribution_401k)

    # 3. Roth IRA
    contribution_roth_ira = 0.0
    if request.include_roth_ira:
        roth_monthly_limit = ROTH_IRA_ANNUAL_LIMIT / 12
        contribution_roth_ira = min(roth_monthly_limit, remaining)
        remaining = max(0.0, remaining - contribution_roth_ira)

    # 4. Brokerage (everything left)
    brokerage_investment = remaining

    return {
        "total_monthly_savings": round(budget, 2),
        "emergency_fund_monthly": round(emergency_monthly, 2),
        "emergency_fund_target": round(target, 2),
        "emergency_fund_current": round(request.current_emergency_fund, 2),
        "months_to_emergency_fund": months_to_goal,
        "contribution_401k": round(contribution_401k, 2),
        "employer_match_401k": round(employer_match_401k, 2),
        "contribution_roth_ira": round(contribution_roth_ira, 2),
        "brokerage_investment": round(brokerage_investment, 2),
    }


def generate_personalized_plan(request: PersonalizedPlanRequest) -> PersonalizedPlanResult:
    """
    Generate a personalized investment plan based on user's profile.

    Args:
        request: User's financial situation and preferences

    Returns:
        Detailed investment plan with real ETF data and projections
    """
    print(f"[DEBUG] Generating personalized plan: ${request.monthly_investment_amount}/mo, {request.risk_tolerance.value} risk, {request.financial_goal.value} goal")

    # Paycheck allocation waterfall (optional — only runs when monthly_gross_income is set)
    paycheck_breakdown = calculate_paycheck_allocation(request)
    effective_monthly = (
        paycheck_breakdown["brokerage_investment"]
        if paycheck_breakdown is not None
        else request.monthly_investment_amount
    )
    months_to_emergency_fund = (
        paycheck_breakdown["months_to_emergency_fund"] if paycheck_breakdown else None
    )

    # Get base portfolio template
    template = PORTFOLIO_TEMPLATES[request.risk_tolerance]
    allocation = template["allocation"].copy()

    # Apply goal-based adjustments
    goal_config = GOAL_ADJUSTMENTS[request.financial_goal]
    for ticker, adjustment in goal_config["adjustments"].items():
        if ticker in allocation:
            allocation[ticker] = allocation[ticker] + adjustment
        else:
            allocation[ticker] = adjustment

    # Normalize to 100%
    total = sum(allocation.values())
    allocation = {k: (v / total) * 100 for k, v in allocation.items()}

    # Get list of tickers with positive allocation
    active_tickers = [t for t, pct in allocation.items() if pct > 0]

    # Fetch all ETF data in a single batch request (avoids rate limiting)
    all_etf_data = market_data_fetcher.get_multiple_etf_data(active_tickers)

    # Build ETF allocations from cached data
    etf_allocations = []
    total_expense_ratio = 0.0

    for ticker, percentage in allocation.items():
        if percentage <= 0:
            continue

        # Get market data from batch result
        etf_data = all_etf_data.get(ticker, market_data_fetcher.get_demo_etf_data(ticker))
        monthly_amount = (percentage / 100) * effective_monthly

        # Get ETF metadata
        etf_info = get_etf_metadata(ticker)

        etf_allocation = ETFAllocation(
            ticker=ticker,
            name=etf_info["name"],
            category=etf_info["category"],
            percentage=round(percentage, 1),
            monthly_amount=round(monthly_amount, 2),
            current_price=etf_data["price"],
            ytd_return=etf_data.get("ytd_return"),
            one_year_return=etf_data.get("one_year_return"),
            expense_ratio=etf_data["expense_ratio"],
            description=etf_info["description"],
            risk_level=etf_info["risk_level"]
        )
        etf_allocations.append(etf_allocation)

        # Calculate weighted expense ratio
        total_expense_ratio += (percentage / 100) * etf_data["expense_ratio"]

    # Calculate projections
    expected_return = template["expected_return"]

    # Adjust expected return based on goal
    if request.financial_goal == FinancialGoal.CAPITAL_PRESERVATION:
        expected_return *= 0.7  # Lower return expectation
    elif request.financial_goal == FinancialGoal.INCOME_GENERATION:
        expected_return *= 0.85

    current_value = request.current_savings

    # Future value calculations (compound interest with monthly contributions)
    # Uses brokerage amount only — 401k/Roth projections are separate account growth
    projected_1yr = calculate_future_value(current_value, effective_monthly, expected_return, 1)
    projected_5yr = calculate_future_value(current_value, effective_monthly, expected_return, 5)
    projected_10yr = calculate_future_value(current_value, effective_monthly, expected_return, 10)
    projected_20yr = calculate_future_value(current_value, effective_monthly, expected_return, 20)
    projected_30yr = calculate_future_value(current_value, effective_monthly, expected_return, 30)

    # Generate reasoning
    reasoning = generate_reasoning(request, template, goal_config, expected_return)

    # Generate next steps
    next_steps = generate_next_steps(request, etf_allocations, paycheck_breakdown)

    # Generate warnings if needed
    warnings = generate_warnings(request)

    # Monthly breakdown
    monthly_breakdown = {
        ticker: round((pct / 100) * effective_monthly, 2)
        for ticker, pct in allocation.items()
        if pct > 0
    }

    result = PersonalizedPlanResult(
        portfolio_name=template["name"],
        risk_profile=request.risk_tolerance.value.title(),
        target_allocation=etf_allocations,
        monthly_investment_breakdown=monthly_breakdown,
        projected_value_1yr=round(projected_1yr, 2),
        projected_value_5yr=round(projected_5yr, 2),
        projected_value_10yr=round(projected_10yr, 2),
        projected_value_20yr=round(projected_20yr, 2),
        projected_value_30yr=round(projected_30yr, 2),
        expected_annual_return=round(expected_return * 100, 1),
        portfolio_expense_ratio=round(total_expense_ratio, 3),
        rebalancing_frequency=template["rebalance"],
        reasoning=reasoning,
        next_steps=next_steps,
        warnings=warnings,
        paycheck_breakdown=paycheck_breakdown,
        months_to_emergency_fund=months_to_emergency_fund,
    )

    print(f"[DEBUG] Plan generated: {template['name']}, {len(etf_allocations)} ETFs, {expected_return * 100:.1f}% expected return")
    return result


def calculate_future_value(current: float, monthly: float, annual_return: float, years: int) -> float:
    """
    Calculate future value with monthly contributions.

    FV = PV(1+r)^n + PMT * [((1+r)^n - 1) / r]
    """
    if annual_return == 0:
        return current + (monthly * 12 * years)

    monthly_rate = annual_return / 12
    months = years * 12

    # Future value of current savings
    fv_current = current * ((1 + monthly_rate) ** months)

    # Future value of monthly contributions
    fv_contributions = monthly * (((1 + monthly_rate) ** months - 1) / monthly_rate)

    return fv_current + fv_contributions


def get_etf_metadata(ticker: str) -> Dict:
    """
    Get ETF names, categories, and descriptions.
    """
    metadata = {
        "VOO": {
            "name": "Vanguard S&P 500 ETF",
            "category": "US Large Cap Stocks",
            "description": "Tracks the S&P 500 - 500 largest US companies. Core holding for long-term growth.",
            "risk_level": "Medium"
        },
        "VTI": {
            "name": "Vanguard Total Stock Market ETF",
            "category": "US Total Market",
            "description": "Entire US stock market - large, mid, and small cap stocks. Ultimate diversification.",
            "risk_level": "Medium"
        },
        "VXUS": {
            "name": "Vanguard Total International Stock ETF",
            "category": "International Stocks",
            "description": "International diversification across developed and emerging markets.",
            "risk_level": "Medium-High"
        },
        "BND": {
            "name": "Vanguard Total Bond Market ETF",
            "category": "US Bonds",
            "description": "Broad US bond exposure for stability and income. Lower volatility than stocks.",
            "risk_level": "Low"
        },
        "AGG": {
            "name": "iShares Core US Aggregate Bond ETF",
            "category": "US Bonds",
            "description": "Investment-grade US bonds for capital preservation and steady income.",
            "risk_level": "Low"
        },
        "VNQ": {
            "name": "Vanguard Real Estate ETF",
            "category": "Real Estate (REITs)",
            "description": "Real estate investment trusts for diversification and dividend income.",
            "risk_level": "Medium-High"
        },
        "QQQ": {
            "name": "Invesco QQQ Trust",
            "category": "US Technology Stocks",
            "description": "Nasdaq-100 tech-heavy index. High growth potential with higher volatility.",
            "risk_level": "High"
        },
        "VWO": {
            "name": "Vanguard Emerging Markets ETF",
            "category": "Emerging Markets",
            "description": "Emerging market stocks for high growth potential. Higher risk and volatility.",
            "risk_level": "High"
        }
    }

    return metadata.get(ticker, {
        "name": ticker,
        "category": "Unknown",
        "description": "ETF details not available",
        "risk_level": "Medium"
    })


def generate_reasoning(request: PersonalizedPlanRequest, template: Dict, goal_config: Dict, expected_return: float) -> List[str]:
    """Generate clear reasoning for the portfolio recommendation."""
    reasoning = []

    # Risk tolerance reasoning
    risk_desc = {
        RiskTolerance.CONSERVATIVE: "You selected conservative risk tolerance, so this portfolio emphasizes stability with bonds and large-cap stocks.",
        RiskTolerance.MODERATE: "You selected moderate risk tolerance, so this portfolio balances growth potential with stability.",
        RiskTolerance.AGGRESSIVE: "You selected aggressive risk tolerance, so this portfolio maximizes growth potential with higher stock allocation."
    }
    reasoning.append(risk_desc[request.risk_tolerance])

    # Goal reasoning
    reasoning.append(f"Your goal is {request.financial_goal.value.replace('_', ' ')} - {goal_config['description'].lower()}")

    # Time horizon reasoning
    if request.time_horizon_years >= 20:
        reasoning.append(f"With a {request.time_horizon_years}-year time horizon, you can weather market volatility and focus on long-term growth.")
    elif request.time_horizon_years >= 10:
        reasoning.append(f"Your {request.time_horizon_years}-year timeline allows for solid growth while managing risk appropriately.")
    else:
        reasoning.append(f"With a {request.time_horizon_years}-year timeline, we balance growth with some stability to protect your capital.")

    # Expected return
    reasoning.append(f"This portfolio targets ~{expected_return * 100:.1f}% annual return based on historical performance of these ETFs.")

    # Monthly investment power (use brokerage amount if paycheck mode, else full budget)
    invest_amount = request.monthly_investment_amount
    total_10yr = calculate_future_value(request.current_savings, invest_amount, expected_return, 10)
    reasoning.append(f"Investing ${invest_amount:.0f}/month could grow to ${total_10yr:,.0f} in 10 years.")

    return reasoning


def generate_next_steps(request: PersonalizedPlanRequest, allocations: List[ETFAllocation], paycheck_breakdown: Optional[Dict] = None) -> List[str]:
    """Generate actionable next steps."""
    steps = []

    if paycheck_breakdown:
        # Paycheck-aware steps
        if paycheck_breakdown["emergency_fund_monthly"] > 0:
            months = paycheck_breakdown["months_to_emergency_fund"]
            steps.append(f"Transfer ${paycheck_breakdown['emergency_fund_monthly']:.0f}/mo to a high-yield savings account for your emergency fund (funded in ~{months} months)")

        if paycheck_breakdown["contribution_401k"] > 0:
            total_401k = paycheck_breakdown["contribution_401k"] + paycheck_breakdown["employer_match_401k"]
            steps.append(f"Contribute ${paycheck_breakdown['contribution_401k']:.0f}/mo to your 401k — your employer adds ${paycheck_breakdown['employer_match_401k']:.0f} for a total of ${total_401k:.0f}/mo")

        if paycheck_breakdown["contribution_roth_ira"] > 0:
            steps.append(f"Contribute ${paycheck_breakdown['contribution_roth_ira']:.0f}/mo to your Roth IRA (Fidelity or Vanguard) — tax-free growth for life")

        steps.append("Open a taxable brokerage account (Fidelity, Vanguard, or Schwab) for your ETF investments")
        steps.append(f"Set up automatic monthly investment of ${paycheck_breakdown['brokerage_investment']:.0f} into your ETF portfolio")
    else:
        if not request.has_emergency_fund:
            steps.append("FIRST: Build 3-6 months emergency fund in a high-yield savings account before investing")

        steps.append("Open a brokerage account (Fidelity, Vanguard, or Schwab are excellent choices)")
        steps.append(f"Set up automatic monthly investment of ${request.monthly_investment_amount:.0f}")

    for alloc in allocations:
        steps.append(f"Buy ${alloc.monthly_amount:.0f} of {alloc.ticker} ({alloc.name}) each month")

    steps.append("Rebalance your portfolio quarterly or semi-annually")
    steps.append("Review and adjust your plan annually or after major life changes")
    steps.append("Don't panic sell during market downturns - stay the course!")

    return steps


def generate_warnings(request: PersonalizedPlanRequest) -> List[str]:
    """Generate warnings based on user's situation."""
    warnings = []

    if not request.has_emergency_fund:
        warnings.append("You indicated no emergency fund. Consider building 3-6 months of expenses in savings BEFORE investing.")

    if request.monthly_investment_amount > 1000 and request.current_savings < 5000:
        warnings.append("High monthly investment with low savings - ensure you have emergency funds first.")

    if request.time_horizon_years < 5 and request.risk_tolerance == RiskTolerance.AGGRESSIVE:
        warnings.append("Aggressive portfolio with short time horizon is risky. Consider moderate risk instead.")

    if request.financial_goal == FinancialGoal.DEBT_FREEDOM:
        warnings.append("Focus on paying off high-interest debt (>6%) before aggressive investing.")

    return warnings if warnings else None
