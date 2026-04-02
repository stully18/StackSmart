"""
Intelligent Action Plan Engine
Analyzes complete financial picture and tells user exactly what to do with their money
"""

from typing import Dict, List


def generate_action_plan(financial_data: Dict, risk_tolerance: int = 7) -> Dict:
    """
    Generate personalized action plan based on complete financial picture.

    Tells user:
    - What debts to pay off (and how much)
    - What to invest (specific funds and amounts)
    - Why (explains the math)

    Args:
        financial_data: Complete financial picture from plaid_service
        risk_tolerance: 1-10 scale for investment recommendations

    Returns:
        Detailed action plan with specific dollar amounts and reasoning
    """

    actions = []
    reasoning = []
    monthly_allocation = {}

    # Extract data
    available_cash = financial_data['bank_accounts']['total_balance']
    investments = financial_data['investments']
    liabilities = financial_data['liabilities']

    student_loans = liabilities.get('student_loans', [])
    credit_cards = liabilities.get('credit_cards', [])

    # Calculate spare cash (keep 3-6 months emergency fund)
    emergency_fund_target = 3000  # Minimum for college students
    spare_cash = max(0, available_cash - emergency_fund_target)

    # Priority 1: Pay off high-interest credit cards (APR > 15%)
    high_interest_cards = [card for card in credit_cards if card['apr'] > 15]
    if high_interest_cards:
        for card in sorted(high_interest_cards, key=lambda x: x['apr'], reverse=True):
            if spare_cash > 0:
                payment_amount = min(spare_cash, card['balance'])
                actions.append({
                    'priority': 1,
                    'action': 'pay_debt',
                    'account': card['name'],
                    'amount': payment_amount,
                    'type': 'credit_card',
                    'reason': f"High APR of {card['apr']:.1f}% - paying this saves you ${(payment_amount * card['apr'] / 100):.2f}/year in interest"
                })
                reasoning.append(f"Credit card debt at {card['apr']:.1f}% APR is costing you money. Pay this off before investing.")
                spare_cash -= payment_amount

    # Priority 2: Build emergency fund if under target
    if available_cash < emergency_fund_target:
        needed = emergency_fund_target - available_cash
        actions.append({
            'priority': 2,
            'action': 'build_emergency_fund',
            'amount': needed,
            'reason': "Financial safety net - prevents going into debt for emergencies"
        })
        reasoning.append(f"Build ${emergency_fund_target} emergency fund before aggressive investing.")

    # Priority 3: Student loans vs investing decision
    if student_loans and spare_cash > 0:
        # Get highest interest student loan
        highest_rate_loan = max(student_loans, key=lambda x: x['interest_rate'])
        loan_rate = highest_rate_loan['interest_rate']

        # Expected market return based on risk tolerance
        if risk_tolerance >= 7:
            expected_return = 10.0  # Aggressive portfolio
        elif risk_tolerance >= 4:
            expected_return = 7.5   # Moderate portfolio
        else:
            expected_return = 5.5   # Conservative portfolio

        # Decision logic
        if loan_rate > expected_return + 2:  # Pay off debt if rate is 2%+ higher
            payment_amount = min(spare_cash, highest_rate_loan['balance'])
            actions.append({
                'priority': 3,
                'action': 'pay_debt',
                'account': highest_rate_loan.get('loan_name', 'Student Loan'),
                'amount': payment_amount,
                'type': 'student_loan',
                'reason': f"Loan rate ({loan_rate:.1f}%) > Expected return ({expected_return:.1f}%) - guaranteed savings"
            })
            reasoning.append(f"Your student loan at {loan_rate:.1f}% costs more than you'd earn investing. Pay it down first.")
            spare_cash -= payment_amount
        else:
            # Invest instead
            actions.append({
                'priority': 3,
                'action': 'invest',
                'amount': spare_cash,
                'recommended_allocation': _get_investment_allocation(spare_cash, risk_tolerance),
                'reason': f"Expected return ({expected_return:.1f}%) > Loan rate ({loan_rate:.1f}%) - invest for growth"
            })
            reasoning.append(f"Your loan rate ({loan_rate:.1f}%) is low. Investing at {expected_return:.1f}% expected return builds more wealth.")
            spare_cash = 0
    elif spare_cash > 0:
        # No student loans - invest it all
        actions.append({
            'priority': 3,
            'action': 'invest',
            'amount': spare_cash,
            'recommended_allocation': _get_investment_allocation(spare_cash, risk_tolerance),
            'reason': "No high-interest debt - invest for long-term growth"
        })
        reasoning.append("You have no debt holding you back. Time to build wealth through investing!")
        spare_cash = 0

    # Priority 4: Roth IRA recommendation
    roth_ira_eligible = True  # Simplified - would check income limits in production
    current_roth_contribution = 0  # Would check from investment accounts

    if roth_ira_eligible and current_roth_contribution < 7500:  # 2026 limit
        actions.append({
            'priority': 4,
            'action': 'open_roth_ira',
            'max_contribution': 7500,
            'current_contribution': current_roth_contribution,
            'remaining': 7500 - current_roth_contribution,
            'reason': "Tax-free growth forever - the earlier you start, the more you benefit"
        })
        reasoning.append("Roth IRA: Your money grows TAX-FREE. A $7,500 investment at age 20 becomes $330,000+ by retirement!")

    # Calculate net worth trajectory
    current_net_worth = financial_data['net_worth']
    projected_net_worth_1yr = _project_net_worth(financial_data, actions, 1)
    projected_net_worth_5yr = _project_net_worth(financial_data, actions, 5)

    return {
        'actions': sorted(actions, key=lambda x: x['priority']),
        'reasoning': reasoning,
        'summary': {
            'total_actions': len(actions),
            'emergency_fund_status': 'good' if available_cash >= emergency_fund_target else 'needs_attention',
            'debt_payoff_recommended': any(a['action'] == 'pay_debt' for a in actions),
            'investment_recommended': any(a['action'] == 'invest' for a in actions)
        },
        'projections': {
            'current_net_worth': current_net_worth,
            'projected_1yr': projected_net_worth_1yr,
            'projected_5yr': projected_net_worth_5yr,
            'gain_1yr': projected_net_worth_1yr - current_net_worth,
            'gain_5yr': projected_net_worth_5yr - current_net_worth
        }
    }


def _get_investment_allocation(amount: float, risk_tolerance: int) -> List[Dict]:
    """Helper to generate specific ETF allocation"""
    allocations = []

    if risk_tolerance >= 7:  # Aggressive
        allocations = [
            {'ticker': 'VOO', 'name': 'S&P 500 ETF', 'percent': 50, 'amount': amount * 0.50},
            {'ticker': 'VXF', 'name': 'Extended Market ETF', 'percent': 20, 'amount': amount * 0.20},
            {'ticker': 'VXUS', 'name': 'International ETF', 'percent': 25, 'amount': amount * 0.25},
            {'ticker': 'BND', 'name': 'Bond ETF', 'percent': 5, 'amount': amount * 0.05}
        ]
    elif risk_tolerance >= 4:  # Moderate
        allocations = [
            {'ticker': 'VOO', 'name': 'S&P 500 ETF', 'percent': 40, 'amount': amount * 0.40},
            {'ticker': 'VXF', 'name': 'Extended Market ETF', 'percent': 15, 'amount': amount * 0.15},
            {'ticker': 'VXUS', 'name': 'International ETF', 'percent': 20, 'amount': amount * 0.20},
            {'ticker': 'BND', 'name': 'Bond ETF', 'percent': 25, 'amount': amount * 0.25}
        ]
    else:  # Conservative
        allocations = [
            {'ticker': 'VOO', 'name': 'S&P 500 ETF', 'percent': 30, 'amount': amount * 0.30},
            {'ticker': 'VXUS', 'name': 'International ETF', 'percent': 15, 'amount': amount * 0.15},
            {'ticker': 'BND', 'name': 'Bond ETF', 'percent': 45, 'amount': amount * 0.45},
            {'ticker': 'HYSA', 'name': 'High-Yield Savings', 'percent': 10, 'amount': amount * 0.10}
        ]

    return allocations


def _project_net_worth(financial_data: Dict, actions: List[Dict], years: int) -> float:
    """Project net worth based on action plan"""
    current_net_worth = financial_data['net_worth']

    # Simplified projection - in production would use more sophisticated modeling
    total_invested = sum(a['amount'] for a in actions if a['action'] == 'invest')
    total_debt_paid = sum(a['amount'] for a in actions if a['action'] == 'pay_debt')

    # Assume 8% annual return on investments
    investment_growth = total_invested * ((1.08 ** years) - 1)

    # Assume debt would have grown at average 6% if not paid
    debt_savings = total_debt_paid * ((1.06 ** years) - 1)

    projected = current_net_worth + investment_growth + debt_savings

    return projected
