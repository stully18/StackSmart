from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from app.services.optimization_engine import calculate_optimization_path
from app.models.schemas import OptimizationRequest, OptimizationResult, MultiLoanOptimizationRequest, MultiLoanOptimizationResult
from app.services import plaid_service
from app.services import investment_planner
from app.services import multi_loan_optimizer
from app.middleware.auth import verify_user_token
from app.services.user_service import save_financial_plan, get_user_plans, delete_plan

app = FastAPI(
    title="StackSmart API",
    description="API for optimizing financial decisions: debt repayment vs investing",
    version="1.0.0"
)

import os

# CORS for Next.js frontend
_cors_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
]
_frontend_url = os.getenv("FRONTEND_URL")
if _frontend_url:
    _cors_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/")
async def root():
    import os
    plaid_configured = bool(os.getenv('PLAID_CLIENT_ID')) and bool(os.getenv('PLAID_SECRET'))

    return {
        "message": "StackSmart API",
        "version": "1.0.0",
        "plaid_configured": plaid_configured,
        "endpoints": {
            "health": "/health",
            "optimize": "/api/optimize"
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "net-worth-optimizer"}


@app.post("/api/optimize", response_model=OptimizationResult)
async def optimize_financial_path(request: OptimizationRequest):
    """
    Calculate optimal financial path: debt repayment vs investing.

    This endpoint compares two scenarios:
    1. Paying extra toward student loans
    2. Investing spare cash in the market

    Returns the recommendation with projected net worth for both paths.
    """
    try:
        result = calculate_optimization_path(
            loan_data=request.loan,
            market_assumptions=request.market_assumptions,
            monthly_budget=request.monthly_budget,
            months_until_graduation=request.months_until_graduation
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    except Exception as e:
        print(f"[ERROR] Optimization failed: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.post("/api/optimize-multi-loan", response_model=MultiLoanOptimizationResult)
async def optimize_multi_loan(request: MultiLoanOptimizationRequest):
    """
    Optimize allocation across multiple loans vs investing.

    Uses debt avalanche method (highest interest rate first) and compares
    against expected market returns to recommend pay debts vs invest.

    Returns:
    - Overall recommendation (pay_debts or invest)
    - Prioritized debt payoff plan (1st, 2nd, 3rd priority)
    - Investment allocations (if recommending invest)
    - Net worth projections
    - Clear reasoning for recommendations
    """
    try:
        print(f"[DEBUG] Multi-loan optimization: {len(request.loans)} loans")

        result = multi_loan_optimizer.calculate_multi_loan_optimization(
            loans=request.loans,
            monthly_budget=request.monthly_budget,
            market_assumptions=request.market_assumptions,
            months_until_graduation=request.months_until_graduation
        )

        print(f"[DEBUG] Recommendation: {result.overall_recommendation}, Confidence: {result.confidence_score}")
        return result
    except ValueError as e:
        print(f"[ERROR] Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    except Exception as e:
        print(f"[ERROR] Optimization failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


# ============= Plaid Integration Endpoints =============

class CreateLinkTokenRequest(BaseModel):
    user_id: str
    account_type: str = "banking"  # "banking" or "investment"

class ExchangeTokenRequest(BaseModel):
    public_token: str

class GetTransactionsRequest(BaseModel):
    access_token: str
    days_back: int = 90

class GetBalanceRequest(BaseModel):
    access_token: str


@app.post("/api/plaid/create-link-token")
async def create_link_token(request: CreateLinkTokenRequest):
    """
    Create a Plaid Link token for initializing Plaid Link in the frontend.
    Supports both banking and investment account connections.
    """
    try:
        result = plaid_service.create_link_token(request.user_id, request.account_type)
        return result
    except Exception as e:
        print(f"[ERROR] Plaid link token creation failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.post("/api/plaid/exchange-token")
async def exchange_public_token(request: ExchangeTokenRequest):
    """
    Exchange a public token for an access token.
    The access token should be stored securely and used for all future API calls.
    """
    try:
        result = plaid_service.exchange_public_token(request.public_token)
        return result
    except Exception as e:
        print(f"[ERROR] Token exchange failed: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.post("/api/plaid/balance")
async def get_account_balance(request: GetBalanceRequest):
    """
    Get account balances for all connected accounts.
    Useful for auto-filling the "spare cash" field.
    """
    try:
        # Note: In production, you'd pass the access_token from a stored user record
        # For now, we accept it in the request (NOT secure for production)
        result = plaid_service.get_account_balance(request.access_token)
        return result
    except Exception as e:
        print(f"[ERROR] Balance fetch failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.post("/api/plaid/transactions")
async def get_transactions(request: GetTransactionsRequest):
    """
    Fetch transaction history and spending analysis.
    """
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=request.days_back)

        transactions = plaid_service.get_transactions(
            request.access_token,
            start_date,
            end_date
        )

        # Analyze spending pattern
        analysis = plaid_service.analyze_spending_pattern(transactions)

        return {
            'transactions': transactions,
            'analysis': analysis
        }
    except Exception as e:
        print(f"[ERROR] Transaction fetch failed: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred.")


# ============= Investment Analysis Endpoints =============

class GetInvestmentDataRequest(BaseModel):
    access_token: str
    days_back: int = 365


@app.post("/api/investments/holdings")
async def get_investment_holdings(request: GetBalanceRequest):
    """
    Get current investment holdings (stocks, bonds, ETFs, etc.)
    Shows portfolio composition, current values, and gains/losses.
    """
    try:
        print(f"[DEBUG] Fetching investment holdings...")
        result = plaid_service.get_investment_holdings(request.access_token)
        print(f"[DEBUG] Found {result['holdings_count']} holdings")
        return result
    except Exception as e:
        print(f"[ERROR] Investment holdings fetch failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.post("/api/investments/transactions")
async def get_investment_transactions(request: GetInvestmentDataRequest):
    """
    Get investment transaction history (buys, sells, dividends, etc.)
    """
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=request.days_back)

        print(f"[DEBUG] Fetching investment transactions from {start_date.date()} to {end_date.date()}...")
        result = plaid_service.get_investment_transactions(
            request.access_token,
            start_date,
            end_date
        )
        print(f"[DEBUG] Found {result['transaction_count']} investment transactions")
        return result
    except Exception as e:
        print(f"[ERROR] Investment transactions fetch failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.post("/api/investments/analyze")
async def analyze_investments(request: GetInvestmentDataRequest):
    """
    Comprehensive investment analysis with personalized recommendations.

    Returns:
    - Investment health score (0-100)
    - Diversification analysis
    - Asset allocation breakdown
    - Recurring deposit detection
    - Fee analysis
    - Personalized recommendations
    """
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=request.days_back)

        print(f"[DEBUG] Running comprehensive investment analysis...")

        # Fetch holdings and transactions
        holdings = plaid_service.get_investment_holdings(request.access_token)
        transactions = plaid_service.get_investment_transactions(
            request.access_token,
            start_date,
            end_date
        )

        # Analyze investment behavior
        analysis = plaid_service.analyze_investment_behavior(holdings, transactions)

        # Combine all data
        result = {
            'holdings_summary': {
                'total_value': holdings['total_value'],
                'holdings_count': holdings['holdings_count'],
                'accounts': holdings['accounts']
            },
            'holdings': holdings['holdings'],
            'recent_transactions': transactions['transactions'][:10],  # Last 10 transactions
            'analysis': analysis
        }

        print("[INFO] Investment analysis complete")
        return result
    except Exception as e:
        print(f"[ERROR] Investment analysis failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


# ============= Investment Planning Endpoints =============

class CreateInvestmentPlanRequest(BaseModel):
    total_portfolio_value: float
    risk_tolerance: int  # 1-10
    monthly_contribution: float = 0


@app.post("/api/investments/create-plan")
async def create_investment_plan(request: CreateInvestmentPlanRequest):
    """
    Generate a personalized investment plan based on portfolio value and risk tolerance.

    Risk Tolerance Scale:
    - 1-3: Conservative (40% stocks, 50% bonds, 10% cash)
    - 4-6: Moderate (60% stocks, 30% bonds, 10% cash)
    - 7-10: Aggressive (80% stocks, 15% bonds, 5% cash)

    Returns specific ETF recommendations with dollar amounts and expected returns.
    """
    try:
        if not 1 <= request.risk_tolerance <= 10:
            raise HTTPException(status_code=400, detail="Risk tolerance must be between 1 and 10")

        if request.total_portfolio_value < 0:
            raise HTTPException(status_code=400, detail="Portfolio value must be positive")

        print(f"[DEBUG] Creating investment plan with risk tolerance {request.risk_tolerance}")

        plan = investment_planner.generate_investment_plan(
            request.total_portfolio_value,
            request.risk_tolerance,
            request.monthly_contribution
        )

        print(f"[DEBUG] Plan created - {plan['risk_profile']} profile with {len(plan['recommendations'])} recommendations")
        return plan
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Investment plan creation failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


# ============= Unified Dashboard Endpoint =============

@app.post("/api/dashboard/complete-picture")
async def get_complete_financial_picture(request: GetBalanceRequest):
    """
    MAIN ENDPOINT for unified dashboard.
    
    Gets everything in one call:
    - Bank accounts (checking, savings)
    - Investment holdings (stocks, ETFs, 401k, IRA)
    - Student loans (balances, interest rates, minimum payments)
    - Credit cards (balances, APRs, utilization)
    - Net worth calculation
    
    Returns complete financial snapshot for the dashboard.
    """
    try:
        print(f"[DEBUG] Fetching complete financial picture...")
        result = plaid_service.get_complete_financial_picture(request.access_token)
        print("[INFO] Complete financial picture fetched")
        return result
    except Exception as e:
        print(f"[ERROR] Complete picture fetch failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


# ============= Action Plan Engine =============

from app.services import action_planner

class GenerateActionPlanRequest(BaseModel):
    access_token: str
    risk_tolerance: int = 7  # 1-10


@app.post("/api/dashboard/action-plan")
async def generate_action_plan(request: GenerateActionPlanRequest):
    """
    Generate intelligent action plan based on complete financial picture.
    
    Tells user EXACTLY what to do:
    - Pay $X to Debt Y
    - Invest $Z in Fund A
    - Why (explains the math)
    
    Takes into account:
    - Debt interest rates vs expected returns
    - Emergency fund status
    - Risk tolerance
    """
    try:
        print(f"[DEBUG] Generating action plan with risk tolerance {request.risk_tolerance}...")

        # Get complete financial picture
        financial_data = plaid_service.get_complete_financial_picture(request.access_token)

        # Generate action plan
        plan = action_planner.generate_action_plan(financial_data, request.risk_tolerance)

        print(f"[DEBUG] Action plan generated - {plan['summary']['total_actions']} actions")
        return plan
    except Exception as e:
        print(f"[ERROR] Action plan generation failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


# ============= Market Data Endpoints =============

from app.services import market_data_service, market_data_fetcher, personalized_planner

class GetMarketDataRequest(BaseModel):
    ticker: str

class GetMultipleMarketDataRequest(BaseModel):
    tickers: list


@app.post("/api/market/quote")
async def get_stock_quote(request: GetMarketDataRequest):
    """
    Get current stock/ETF price and daily change.

    Example: {"ticker": "VOO"}
    """
    try:
        quote = market_data_service.get_stock_quote(request.ticker.upper())
        return quote
    except Exception as e:
        print(f"[ERROR] Stock quote fetch failed: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.post("/api/market/etf-details")
async def get_etf_details(request: GetMarketDataRequest):
    """
    Get comprehensive ETF data: price, returns, dividend yield, expense ratio.

    Perfect for displaying complete investment information.
    """
    try:
        print(f"[DEBUG] Fetching market data for {request.ticker}...")
        details = market_data_service.get_etf_details(request.ticker.upper())
        print("[INFO] ETF details fetched")
        return details
    except Exception as e:
        print(f"[ERROR] Market data fetch failed: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.post("/api/market/batch-etf-data")
async def get_multiple_etf_data(request: GetMultipleMarketDataRequest):
    """
    Batch fetch market data for multiple ETFs.

    Example: {"tickers": ["VOO", "VXUS", "BND"]}

    Returns dict with ticker as key and full details as value.
    """
    try:
        print(f"[DEBUG] Fetching batch market data for {len(request.tickers)} tickers...")
        data = market_data_service.get_multiple_etf_data(request.tickers)
        print(f"[DEBUG] Batch fetch complete")
        return data
    except Exception as e:
        print(f"[ERROR] Batch market data fetch failed: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.get("/api/market/voo-live")
async def get_voo_live_data():
    """
    Get live VOO (S&P 500 ETF) market data.

    Returns:
    - Current price
    - Today's change percentage
    - YTD return
    - 1-year return
    - 5-year average return
    - Data source (Alpha Vantage or Yahoo Finance)
    - Last updated timestamp

    Free tier: Uses Yahoo Finance (no API key needed) with Alpha Vantage fallback.
    """
    try:
        print("[DEBUG] Fetching live VOO market data...")
        data = market_data_fetcher.get_voo_live_data()
        print("[INFO] VOO live data fetched")
        return data
    except Exception as e:
        print(f"[ERROR] VOO live data fetch failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.get("/api/market/sp500-performance")
async def get_sp500_performance():
    """
    Get S&P 500 index performance data.

    Returns:
    - 1-year return
    - Historical average return
    - Last updated timestamp
    """
    try:
        print("[DEBUG] Fetching S&P 500 performance data...")
        data = market_data_fetcher.get_sp500_performance()
        print("[INFO] S&P 500 performance data fetched")
        return data
    except Exception as e:
        print(f"[ERROR] S&P 500 performance fetch failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


@app.get("/api/market/etf/{ticker}")
async def get_etf_data(ticker: str):
    """
    Get detailed market data for a specific ETF.

    Returns:
    - Current price
    - YTD and 1-year returns
    - Expense ratio
    - Category and description
    """
    try:
        print(f"[DEBUG] Fetching market data for {ticker}...")
        data = market_data_fetcher.get_etf_details(ticker.upper())
        print(f"[INFO] ETF data fetched for {ticker}")
        return data
    except Exception as e:
        print(f"[ERROR] ETF data fetch failed for {ticker}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


# ============= Personalized Financial Plan Endpoints =============

from app.models.schemas import PersonalizedPlanRequest, PersonalizedPlanResult


@app.post("/api/plan/generate", response_model=PersonalizedPlanResult)
async def generate_financial_plan(request: PersonalizedPlanRequest):
    """
    Generate a personalized investment plan based on user's profile.

    Takes into account:
    - Monthly investment amount
    - Risk tolerance (conservative, moderate, aggressive)
    - Financial goals (wealth building, income, preservation, debt freedom)
    - Time horizon
    - Current savings
    - Emergency fund status

    Returns:
    - Customized ETF portfolio with real market data
    - Expected returns and projections
    - Monthly investment breakdown
    - Actionable next steps
    - Warnings if applicable

    Uses REAL market data for ETF prices and performance.
    """
    try:
        print(f"[DEBUG] Generating personalized plan: {request.risk_tolerance.value} risk, {request.financial_goal.value} goal")

        plan = personalized_planner.generate_personalized_plan(request)

        print(f"[DEBUG] Plan generated: {plan.portfolio_name}, {len(plan.target_allocation)} ETFs, {plan.expected_annual_return}% expected return")
        return plan
    except Exception as e:
        print(f"[ERROR] Plan generation failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")


# ============= User-Scoped Data Endpoints =============

@app.post("/api/plans/save")
async def save_plan(
    request: Request,
    user_id: str = Depends(verify_user_token)
):
    """Save a financial plan"""
    body = await request.json()
    result = await save_financial_plan(user_id, body["plan_name"], body["plan_type"], body["data"])
    return {"success": True, "data": result}

@app.get("/api/plans")
async def list_plans(user_id: str = Depends(verify_user_token)):
    """Get all user's saved plans"""
    plans = await get_user_plans(user_id)
    return {"plans": plans}

@app.delete("/api/plans/{plan_name}")
async def delete_plan_endpoint(
    plan_name: str,
    user_id: str = Depends(verify_user_token)
):
    """Delete a saved plan"""
    result = await delete_plan(user_id, plan_name)
    return result
