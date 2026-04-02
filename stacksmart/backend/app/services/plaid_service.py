import os
from datetime import datetime, timedelta
from typing import Dict, List
import plaid
from plaid.api import plaid_api
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest
from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
from plaid.model.investments_transactions_get_request import InvestmentsTransactionsGetRequest
from plaid.model.liabilities_get_request import LiabilitiesGetRequest
from dotenv import load_dotenv

load_dotenv()

# Plaid configuration
PLAID_CLIENT_ID = os.getenv('PLAID_CLIENT_ID')
PLAID_SECRET = os.getenv('PLAID_SECRET')
PLAID_ENV = os.getenv('PLAID_ENV', 'sandbox')

# Map environment to Plaid host
# Updated for newer plaid-python API
PLAID_HOST_MAP = {
    'sandbox': 'https://sandbox.plaid.com',
    'development': 'https://development.plaid.com',
    'production': 'https://production.plaid.com'
}

# Initialize Plaid client
configuration = plaid.Configuration(
    host=PLAID_HOST_MAP[PLAID_ENV],
    api_key={
        'clientId': PLAID_CLIENT_ID,
        'secret': PLAID_SECRET,
    }
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)


def create_link_token(user_id: str, account_type: str = "all") -> Dict:
    """
    Create a Link token for Plaid Link initialization.

    Args:
        user_id: Unique user identifier
        account_type: "all" gets everything (recommended), "banking", or "investment"
    """
    try:
        # For unified platform, request all products to get complete financial picture
        if account_type == "all":
            products = [
                Products("auth"),
                Products("transactions"),
                Products("investments"),
                Products("liabilities")  # Student loans, credit cards
            ]
        elif account_type == "investment":
            products = [Products("investments"), Products("auth")]
        else:
            products = [Products("auth"), Products("transactions")]

        request = LinkTokenCreateRequest(
            products=products,
            client_name="College Wealth Builder",
            country_codes=[CountryCode('US')],
            language='en',
            user=LinkTokenCreateRequestUser(
                client_user_id=user_id
            )
        )
        response = client.link_token_create(request)
        return {
            'link_token': response['link_token'],
            'expiration': response['expiration']
        }
    except plaid.ApiException as e:
        raise Exception(f"Error creating link token: {e}")


def exchange_public_token(public_token: str) -> Dict:
    """
    Exchange a public token for an access token.
    The access token is used for all subsequent API calls.
    """
    try:
        request = ItemPublicTokenExchangeRequest(
            public_token=public_token
        )
        response = client.item_public_token_exchange(request)
        return {
            'access_token': response['access_token'],
            'item_id': response['item_id']
        }
    except plaid.ApiException as e:
        raise Exception(f"Error exchanging public token: {e}")


def get_transactions(access_token: str, start_date: datetime, end_date: datetime) -> List[Dict]:
    """
    Fetch transactions for a given date range.
    Useful for spending analysis and cash flow prediction.
    """
    try:
        request = TransactionsGetRequest(
            access_token=access_token,
            start_date=start_date.date(),
            end_date=end_date.date()
        )
        response = client.transactions_get(request)

        transactions = []
        for txn in response['transactions']:
            transactions.append({
                'transaction_id': txn['transaction_id'],
                'date': txn['date'].isoformat(),
                'name': txn['name'],
                'amount': txn['amount'],
                'category': txn['category'],
                'pending': txn['pending']
            })

        return transactions
    except plaid.ApiException as e:
        raise Exception(f"Error fetching transactions: {e}")


def get_account_balance(access_token: str) -> Dict:
    """
    Get current account balances.
    Useful for auto-filling "spare cash" field.
    """
    try:
        request = AccountsBalanceGetRequest(
            access_token=access_token
        )
        response = client.accounts_balance_get(request)

        # Convert Plaid response to dict to avoid circular references
        response_dict = response.to_dict()

        accounts = []
        total_balance = 0

        for account in response_dict['accounts']:
            balance = account['balances']['current'] or 0
            accounts.append({
                'account_id': account['account_id'],
                'name': account['name'],
                'type': account['type'],
                'subtype': account.get('subtype'),
                'balance': float(balance)
            })
            total_balance += balance

        return {
            'accounts': accounts,
            'total_balance': float(total_balance)
        }
    except plaid.ApiException as e:
        raise Exception(f"Error fetching account balance: {e}")


def analyze_spending_pattern(transactions: List[Dict]) -> Dict:
    """
    Analyze transaction data to extract spending patterns.
    Returns monthly average spending and category breakdown.
    """
    if not transactions:
        return {
            'monthly_average': 0,
            'category_breakdown': {},
            'total_spent': 0
        }

    # Filter out income (negative amounts in Plaid)
    expenses = [t for t in transactions if t['amount'] > 0]

    # Calculate total and average
    total_spent = sum(t['amount'] for t in expenses)

    # Calculate number of months
    dates = [datetime.fromisoformat(t['date']) for t in expenses]
    if dates:
        date_range = (max(dates) - min(dates)).days
        num_months = max(1, date_range / 30)
        monthly_average = total_spent / num_months
    else:
        monthly_average = 0

    # Category breakdown
    category_totals = {}
    for txn in expenses:
        categories = txn.get('category', ['Other'])
        main_category = categories[0] if categories else 'Other'
        category_totals[main_category] = category_totals.get(main_category, 0) + txn['amount']

    return {
        'monthly_average': round(monthly_average, 2),
        'category_breakdown': category_totals,
        'total_spent': round(total_spent, 2),
        'transaction_count': len(expenses)
    }


def get_investment_holdings(access_token: str) -> Dict:
    """
    Get current investment holdings (stocks, ETFs, bonds, etc.)
    Returns portfolio positions with current values.
    """
    try:
        request = InvestmentsHoldingsGetRequest(
            access_token=access_token
        )
        response = client.investments_holdings_get(request)
        response_dict = response.to_dict()

        holdings = []
        total_value = 0
        accounts = {}

        # Process securities (stocks, ETFs, etc.)
        securities = {sec['security_id']: sec for sec in response_dict.get('securities', [])}

        # Process holdings
        for holding in response_dict.get('holdings', []):
            security = securities.get(holding['security_id'], {})

            current_value = holding['institution_value'] or (holding['quantity'] * holding.get('institution_price', 0))
            cost_basis = holding.get('cost_basis')

            holding_data = {
                'security_id': holding['security_id'],
                'account_id': holding['account_id'],
                'ticker': security.get('ticker_symbol'),
                'name': security.get('name'),
                'type': security.get('type'),
                'quantity': float(holding['quantity']),
                'price': float(holding.get('institution_price', 0)),
                'value': float(current_value),
                'cost_basis': float(cost_basis) if cost_basis else None,
            }

            # Calculate gain/loss if cost basis available
            if cost_basis and cost_basis > 0:
                holding_data['gain_loss'] = float(current_value - cost_basis)
                holding_data['gain_loss_percent'] = float((current_value - cost_basis) / cost_basis * 100)

            holdings.append(holding_data)
            total_value += current_value

            # Track by account
            acct_id = holding['account_id']
            if acct_id not in accounts:
                accounts[acct_id] = {'holdings': [], 'total_value': 0}
            accounts[acct_id]['holdings'].append(holding_data)
            accounts[acct_id]['total_value'] += current_value

        # Process accounts
        account_list = []
        for account in response_dict.get('accounts', []):
            acct_id = account['account_id']
            acct_data = accounts.get(acct_id, {'holdings': [], 'total_value': 0})

            account_list.append({
                'account_id': acct_id,
                'name': account['name'],
                'type': account['type'],
                'subtype': account.get('subtype'),
                'balance': float(account['balances'].get('current', 0)),
                'holdings_value': acct_data['total_value'],
                'holdings_count': len(acct_data['holdings'])
            })

        return {
            'holdings': holdings,
            'accounts': account_list,
            'total_value': float(total_value),
            'holdings_count': len(holdings)
        }
    except plaid.ApiException as e:
        raise Exception(f"Error fetching investment holdings: {e}")


def get_investment_transactions(access_token: str, start_date: datetime, end_date: datetime) -> Dict:
    """
    Get investment transactions (buys, sells, dividends, etc.)
    Useful for detecting recurring deposits and analyzing investment behavior.
    """
    try:
        request = InvestmentsTransactionsGetRequest(
            access_token=access_token,
            start_date=start_date.date(),
            end_date=end_date.date()
        )
        response = client.investments_transactions_get(request)
        response_dict = response.to_dict()

        transactions = []
        securities = {sec['security_id']: sec for sec in response_dict.get('securities', [])}

        for txn in response_dict.get('investment_transactions', []):
            security = securities.get(txn.get('security_id'), {})

            transactions.append({
                'transaction_id': txn['investment_transaction_id'],
                'account_id': txn['account_id'],
                'date': txn['date'].isoformat() if isinstance(txn['date'], datetime) else txn['date'],
                'type': txn['type'],  # buy, sell, dividend, etc.
                'subtype': txn.get('subtype'),
                'ticker': security.get('ticker_symbol'),
                'name': security.get('name'),
                'quantity': float(txn.get('quantity', 0)),
                'price': float(txn.get('price', 0)),
                'amount': float(txn['amount']),
                'fees': float(txn.get('fees', 0))
            })

        return {
            'transactions': transactions,
            'transaction_count': len(transactions)
        }
    except plaid.ApiException as e:
        raise Exception(f"Error fetching investment transactions: {e}")


def analyze_investment_behavior(holdings: Dict, transactions: Dict) -> Dict:
    """
    Analyze investment behavior and provide recommendations.

    Checks for:
    - Diversification
    - Recurring deposits
    - Asset allocation (stocks vs bonds)
    - Investment frequency
    - Fee analysis
    """
    analysis = {
        'health_score': 0,
        'recommendations': [],
        'strengths': [],
        'warnings': []
    }

    # 1. Diversification Analysis
    holdings_list = holdings.get('holdings', [])
    unique_tickers = set(h['ticker'] for h in holdings_list if h.get('ticker'))

    if len(unique_tickers) == 0:
        analysis['warnings'].append("No holdings found")
        analysis['health_score'] = 0
    elif len(unique_tickers) == 1:
        analysis['warnings'].append("Portfolio is not diversified - all funds in one security")
        analysis['health_score'] += 20
    elif len(unique_tickers) < 5:
        analysis['recommendations'].append(f"Consider diversifying - currently only {len(unique_tickers)} different securities")
        analysis['health_score'] += 50
    else:
        analysis['strengths'].append(f"Good diversification with {len(unique_tickers)} different securities")
        analysis['health_score'] += 80

    # 2. Asset Allocation
    stock_value = sum(h['value'] for h in holdings_list if h.get('type') in ['equity', 'etf'])
    bond_value = sum(h['value'] for h in holdings_list if h.get('type') == 'bond')
    total_value = holdings.get('total_value', 0)

    if total_value > 0:
        stock_percent = (stock_value / total_value) * 100
        bond_percent = (bond_value / total_value) * 100

        analysis['asset_allocation'] = {
            'stocks': round(stock_percent, 1),
            'bonds': round(bond_percent, 1),
            'other': round(100 - stock_percent - bond_percent, 1)
        }

        # For college students, recommend aggressive allocation
        if stock_percent > 80:
            analysis['strengths'].append(f"Aggressive allocation ({stock_percent:.0f}% stocks) - good for long-term growth")
        elif stock_percent < 60:
            analysis['recommendations'].append("Consider increasing stock allocation - you have time for growth")

    # 3. Recurring Deposit Detection
    txn_list = transactions.get('transactions', [])
    buy_txns = [t for t in txn_list if t['type'] == 'buy']

    if len(buy_txns) >= 2:
        # Group by month
        monthly_buys = {}
        for txn in buy_txns:
            date_str = txn['date'] if isinstance(txn['date'], str) else txn['date'].isoformat()
            month = date_str[:7]  # YYYY-MM
            monthly_buys[month] = monthly_buys.get(month, 0) + abs(txn['amount'])

        if len(monthly_buys) >= 2:
            avg_monthly_investment = sum(monthly_buys.values()) / len(monthly_buys)
            analysis['recurring_deposits'] = {
                'detected': True,
                'average_monthly': round(avg_monthly_investment, 2),
                'months_active': len(monthly_buys)
            }
            analysis['strengths'].append(f"Consistent investing detected - averaging ${avg_monthly_investment:.0f}/month")
            analysis['health_score'] += 15
        else:
            analysis['recurring_deposits'] = {'detected': False}
            analysis['recommendations'].append("Set up automatic recurring investments for dollar-cost averaging")

    # 4. Fee Analysis
    total_fees = sum(t.get('fees', 0) for t in txn_list)
    if total_fees > 100:
        analysis['warnings'].append(f"High trading fees detected: ${total_fees:.2f} total")
    elif total_fees > 0:
        analysis['fee_analysis'] = {
            'total_fees': round(total_fees, 2),
            'average_per_trade': round(total_fees / max(len(txn_list), 1), 2)
        }

    # 5. Investment Frequency
    if len(buy_txns) > 0:
        dates = [datetime.fromisoformat(t['date']) if isinstance(t['date'], str) else t['date'] for t in buy_txns]
        if len(dates) > 1:
            date_range = (max(dates) - min(dates)).days
            avg_days_between = date_range / max(len(dates) - 1, 1)

            if avg_days_between < 35:  # Monthly or more frequent
                analysis['strengths'].append("Regular investment schedule maintained")
                analysis['health_score'] += 5
            elif avg_days_between > 90:
                analysis['recommendations'].append("Invest more frequently for better dollar-cost averaging")

    # Cap health score at 100
    analysis['health_score'] = min(analysis['health_score'], 100)

    return analysis


def get_liabilities(access_token: str) -> Dict:
    """
    Get liabilities including student loans and credit cards.
    Returns debt amounts, interest rates, and minimum payments.
    """
    try:
        request = LiabilitiesGetRequest(
            access_token=access_token
        )
        response = client.liabilities_get(request)
        response_dict = response.to_dict()

        liabilities = {
            'student_loans': [],
            'credit_cards': [],
            'total_student_loan_debt': 0,
            'total_credit_card_debt': 0,
            'total_debt': 0
        }

        # Process student loans
        for loan in response_dict.get('liabilities', {}).get('student', []):
            loan_data = {
                'loan_id': loan.get('account_id'),
                'servicer': loan.get('servicer_address', {}).get('city', 'Unknown'),
                'loan_status': loan.get('loan_status', {}).get('type'),
                'interest_rate': float(loan.get('interest_rate_percentage', 0)),
                'balance': float(loan.get('outstanding_interest_amount', 0) + loan.get('ytd_principal_paid', 0)),
                'minimum_payment': float(loan.get('minimum_payment_amount', 0)),
                'next_payment_date': loan.get('next_payment_due_date'),
                'loan_name': loan.get('loan_name')
            }
            liabilities['student_loans'].append(loan_data)
            liabilities['total_student_loan_debt'] += loan_data['balance']

        # Process credit cards
        for card in response_dict.get('liabilities', {}).get('credit', []):
            card_data = {
                'card_id': card.get('account_id'),
                'name': card.get('account_name'),
                'balance': float(card.get('last_statement_balance', 0)),
                'apr': float(card.get('aprs', [{}])[0].get('apr_percentage', 0)) if card.get('aprs') else 0,
                'minimum_payment': float(card.get('minimum_payment_amount', 0)),
                'credit_limit': float(card.get('credit_limit', 0)),
                'utilization': (float(card.get('last_statement_balance', 0)) / float(card.get('credit_limit', 1))) * 100 if card.get('credit_limit') else 0
            }
            liabilities['credit_cards'].append(card_data)
            liabilities['total_credit_card_debt'] += card_data['balance']

        liabilities['total_debt'] = liabilities['total_student_loan_debt'] + liabilities['total_credit_card_debt']

        return liabilities
    except plaid.ApiException as e:
        # If liabilities product not available, return empty
        print(f"[WARNING] Could not fetch liabilities: {e}")
        return {
            'student_loans': [],
            'credit_cards': [],
            'total_student_loan_debt': 0,
            'total_credit_card_debt': 0,
            'total_debt': 0
        }


def get_complete_financial_picture(access_token: str) -> Dict:
    """
    Get comprehensive financial data: bank accounts, investments, and debts.
    This is the main function for the unified dashboard.
    """
    try:
        print("[DEBUG] Fetching complete financial picture...")

        # Get bank accounts
        bank_data = get_account_balance(access_token)

        # Get investments (if available)
        try:
            investment_data = get_investment_holdings(access_token)
        except Exception as e:
            print(f"[INFO] No investment accounts found: {e}")
            investment_data = {
                'holdings': [],
                'accounts': [],
                'total_value': 0,
                'holdings_count': 0
            }

        # Get liabilities (loans and credit cards)
        liabilities_data = get_liabilities(access_token)

        # Separate liquid (bank accounts) from retirement accounts
        liquid_cash = bank_data['total_balance']

        # Categorize investment accounts
        retirement_accounts = []
        taxable_accounts = []
        total_retirement_value = 0
        total_taxable_investment_value = 0

        for account in investment_data.get('accounts', {}).values():
            account_type = account.get('type', '').lower()
            account_subtype = account.get('subtype', '').lower()
            account_name = account.get('name', '').lower()

            # Identify retirement accounts
            is_retirement = (
                '401k' in account_type or '401k' in account_subtype or '401k' in account_name or
                'ira' in account_type or 'ira' in account_subtype or 'ira' in account_name or
                'roth' in account_type or 'roth' in account_subtype or 'roth' in account_name or
                '403b' in account_type or '403b' in account_subtype or '403b' in account_name or
                'retirement' in account_type or 'retirement' in account_subtype
            )

            if is_retirement:
                retirement_accounts.append(account)
                total_retirement_value += account.get('balance', 0)
            else:
                taxable_accounts.append(account)
                total_taxable_investment_value += account.get('balance', 0)

        # Calculate different net worth metrics
        liquid_assets = liquid_cash + total_taxable_investment_value  # Only liquid/accessible money
        total_assets = liquid_cash + total_taxable_investment_value + total_retirement_value
        total_liabilities = liabilities_data['total_debt']
        net_worth = total_assets - total_liabilities
        liquid_net_worth = liquid_assets - total_liabilities  # Net worth excluding retirement

        return {
            'net_worth': float(net_worth),
            'liquid_net_worth': float(liquid_net_worth),  # NEW: Excludes retirement accounts
            'total_assets': float(total_assets),
            'liquid_assets': float(liquid_assets),  # NEW: Only accessible money
            'total_liabilities': float(total_liabilities),
            'bank_accounts': {
                'accounts': bank_data['accounts'],
                'total_balance': bank_data['total_balance']
            },
            'investments': {
                'holdings': investment_data['holdings'],
                'taxable_accounts': taxable_accounts,
                'retirement_accounts': retirement_accounts,
                'total_taxable_value': float(total_taxable_investment_value),
                'total_retirement_value': float(total_retirement_value),
                'total_value': investment_data['total_value']
            },
            'liabilities': liabilities_data
        }
    except Exception as e:
        raise Exception(f"Error fetching complete financial picture: {e}")
