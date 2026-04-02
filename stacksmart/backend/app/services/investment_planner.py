"""
Investment Planning Service
Generates personalized investment recommendations based on portfolio value and risk tolerance
Includes real-time market data for recommended ETFs
"""

from typing import Dict, List
from app.services import market_data_service


def generate_investment_plan(
    total_portfolio_value: float,
    risk_tolerance: int,  # 1-10 scale
    monthly_contribution: float = 0
) -> Dict:
    """
    Generate a personalized investment plan based on portfolio value and risk tolerance.

    Args:
        total_portfolio_value: Current total portfolio value
        risk_tolerance: Risk tolerance on a scale of 1-10
            1-3: Conservative (capital preservation)
            4-6: Moderate (balanced growth)
            7-10: Aggressive (maximum growth)
        monthly_contribution: Expected monthly investment amount

    Returns:
        Dictionary containing allocation strategy, specific fund recommendations,
        and personalized advice
    """

    # Determine risk profile
    if risk_tolerance <= 3:
        risk_profile = "conservative"
        stocks_percent = 40
        bonds_percent = 50
        cash_percent = 10
    elif risk_tolerance <= 6:
        risk_profile = "moderate"
        stocks_percent = 60
        bonds_percent = 30
        cash_percent = 10
    else:
        risk_profile = "aggressive"
        stocks_percent = 80
        bonds_percent = 15
        cash_percent = 5

    # Calculate dollar amounts
    stocks_amount = total_portfolio_value * (stocks_percent / 100)
    bonds_amount = total_portfolio_value * (bonds_percent / 100)
    cash_amount = total_portfolio_value * (cash_percent / 100)

    # Generate specific fund recommendations
    recommendations = []
    tickers_to_fetch = []

    # Stock allocation
    if stocks_percent > 0:
        # US Large Cap
        us_large_cap_percent = stocks_percent * 0.50
        tickers_to_fetch.append('VOO')
        recommendations.append({
            'category': 'US Large Cap Stocks',
            'ticker': 'VOO',
            'name': 'Vanguard S&P 500 ETF',
            'allocation_percent': us_large_cap_percent,
            'dollar_amount': total_portfolio_value * (us_large_cap_percent / 100),
            'expense_ratio': 0.03,
            'reason': 'Low-cost exposure to 500 largest US companies. Foundation of any portfolio.'
        })

        # US Small/Mid Cap
        us_small_cap_percent = stocks_percent * 0.20
        tickers_to_fetch.append('VXF')
        recommendations.append({
            'category': 'US Small/Mid Cap Stocks',
            'ticker': 'VXF',
            'name': 'Vanguard Extended Market ETF',
            'allocation_percent': us_small_cap_percent,
            'dollar_amount': total_portfolio_value * (us_small_cap_percent / 100),
            'expense_ratio': 0.06,
            'reason': 'Diversification beyond large caps. Higher growth potential.'
        })

        # International
        intl_percent = stocks_percent * 0.30
        tickers_to_fetch.append('VXUS')
        recommendations.append({
            'category': 'International Stocks',
            'ticker': 'VXUS',
            'name': 'Vanguard Total International Stock ETF',
            'allocation_percent': intl_percent,
            'dollar_amount': total_portfolio_value * (intl_percent / 100),
            'expense_ratio': 0.07,
            'reason': 'Global diversification. Exposure to developed and emerging markets.'
        })

    # Bond allocation
    if bonds_percent > 0:
        # Total Bond Market
        bond_percent = bonds_percent
        tickers_to_fetch.append('BND')
        recommendations.append({
            'category': 'US Bonds',
            'ticker': 'BND',
            'name': 'Vanguard Total Bond Market ETF',
            'allocation_percent': bond_percent,
            'dollar_amount': total_portfolio_value * (bond_percent / 100),
            'expense_ratio': 0.03,
            'reason': 'Stability and income. Reduces portfolio volatility.'
        })

    # Cash/Emergency fund
    if cash_percent > 0:
        recommendations.append({
            'category': 'Cash/Emergency Fund',
            'ticker': 'HYSA',
            'name': 'High-Yield Savings Account',
            'allocation_percent': cash_percent,
            'dollar_amount': total_portfolio_value * (cash_percent / 100),
            'expense_ratio': 0.0,
            'reason': 'Liquidity and safety. Earn 4-5% APY with no market risk.'
        })

    # Fetch real-time market data for all recommended ETFs
    print(f"[DEBUG] Fetching market data for {len(tickers_to_fetch)} ETFs...")
    market_data = {}
    try:
        market_data = market_data_service.get_multiple_etf_data(tickers_to_fetch)
        print(f"[DEBUG] Market data fetched successfully")
    except Exception as e:
        print(f"[WARNING] Failed to fetch market data: {str(e)}")
        # Continue without market data

    # Enrich recommendations with market data
    for rec in recommendations:
        ticker = rec['ticker']
        if ticker in market_data:
            data = market_data[ticker]
            rec['market_data'] = {
                'current_price': data['price'],
                'daily_change': data['change'],
                'daily_change_percent': data['change_percent'],
                '1yr_return': data['returns']['1yr_return'],
                '5yr_return': data['returns']['5yr_return'],
                '10yr_return': data['returns']['10yr_return'],
                'dividend_yield': data['dividend_yield'],
                'last_updated': data['last_updated']
            }

    # Generate monthly contribution allocation
    monthly_allocation = []
    if monthly_contribution > 0:
        for rec in recommendations:
            if rec['ticker'] != 'HYSA':  # Don't auto-invest in cash
                monthly_allocation.append({
                    'ticker': rec['ticker'],
                    'name': rec['name'],
                    'monthly_amount': monthly_contribution * (rec['allocation_percent'] / 100)
                })

    # Generate personalized advice
    advice = []

    if risk_profile == "conservative":
        advice.append("Your conservative approach prioritizes capital preservation over growth.")
        advice.append("Consider increasing stock allocation once you're comfortable with market volatility.")
        advice.append("This portfolio is suitable if you need the money within 5 years.")
    elif risk_profile == "moderate":
        advice.append("Your balanced approach provides both growth potential and downside protection.")
        advice.append("This allocation is ideal for medium-term goals (5-15 years).")
        advice.append("Consider rebalancing annually to maintain your target allocation.")
    else:
        advice.append("Your aggressive approach maximizes long-term growth potential.")
        advice.append("Be prepared for significant short-term volatility - don't panic sell!")
        advice.append("This portfolio is best for goals 15+ years away (like retirement).")

    # Portfolio-size specific advice
    if total_portfolio_value < 1000:
        advice.append("Focus on just 1-2 ETFs to minimize transaction costs. VOO is a great start.")
    elif total_portfolio_value < 10000:
        advice.append("You can now diversify across 3-4 ETFs without excessive transaction costs.")
    else:
        advice.append("Your portfolio size allows full diversification across all recommended funds.")

    # Monthly contribution advice
    if monthly_contribution > 0:
        advice.append(f"Set up automatic monthly investments of ${monthly_contribution:.0f} for dollar-cost averaging.")
        if monthly_contribution < 100:
            advice.append("Consider using a broker with fractional shares to invest small amounts.")

    # Calculate expected returns
    if risk_profile == "conservative":
        expected_annual_return = 5.5
    elif risk_profile == "moderate":
        expected_annual_return = 7.5
    else:
        expected_annual_return = 9.5

    # Project growth
    years_projection = 10
    future_value = total_portfolio_value * ((1 + expected_annual_return / 100) ** years_projection)

    if monthly_contribution > 0:
        # Add future value of monthly contributions
        months = years_projection * 12
        monthly_rate = expected_annual_return / 100 / 12
        fv_contributions = monthly_contribution * (((1 + monthly_rate) ** months - 1) / monthly_rate)
        future_value += fv_contributions

    return {
        'risk_profile': risk_profile,
        'risk_tolerance': risk_tolerance,
        'allocation': {
            'stocks': stocks_percent,
            'bonds': bonds_percent,
            'cash': cash_percent
        },
        'allocation_dollars': {
            'stocks': round(stocks_amount, 2),
            'bonds': round(bonds_amount, 2),
            'cash': round(cash_amount, 2)
        },
        'recommendations': recommendations,
        'monthly_allocation': monthly_allocation,
        'advice': advice,
        'projections': {
            'expected_annual_return': expected_annual_return,
            'years': years_projection,
            'current_value': round(total_portfolio_value, 2),
            'future_value': round(future_value, 2),
            'total_gain': round(future_value - total_portfolio_value, 2)
        },
        'next_steps': [
            f"Open a brokerage account if you don't have one (Fidelity, Vanguard, or Schwab)",
            f"Set up automatic monthly contributions of ${monthly_contribution:.0f}" if monthly_contribution > 0 else "Decide on a monthly contribution amount",
            f"Buy your first ETF: {recommendations[0]['ticker']} ({recommendations[0]['name']})",
            "Enable dividend reinvestment (DRIP) to compound your returns",
            "Review and rebalance your portfolio annually"
        ]
    }
