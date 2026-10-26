import os

from app.models.schemas import ETFAllocation, FinancialGoal, PersonalizedPlanRequest, PersonalizedPlanResult, RiskTolerance
from app.services import ai_financial_planner
from app.services.ai_financial_planner import generate_ai_financial_plan


def _sample_plan() -> PersonalizedPlanResult:
    return PersonalizedPlanResult(
        portfolio_name="Mock Portfolio",
        risk_profile="moderate",
        target_allocation=[
            ETFAllocation(
                ticker="VOO",
                name="Vanguard S&P 500 ETF",
                category="US Stocks",
                percentage=100,
                monthly_amount=500,
                current_price=500,
                expense_ratio=0.03,
                description="Broad US equity exposure",
                risk_level="medium",
            )
        ],
        monthly_investment_breakdown={"VOO": 500},
        projected_value_1yr=6200,
        projected_value_5yr=35000,
        projected_value_10yr=85000,
        projected_value_20yr=280000,
        projected_value_30yr=700000,
        expected_annual_return=8.0,
        portfolio_expense_ratio=0.03,
        rebalancing_frequency="Annual",
        reasoning=["Uses a diversified low-cost fund."],
        next_steps=["Review before acting."],
        warnings=["Educational guidance only."],
    )


def test_generate_ai_financial_plan_falls_back_when_disabled(monkeypatch):
    """With ENABLE_GEMINI_FINANCIAL_PLANS=false the service returns the
    deterministic baseline plus a disabled notice, and NEVER calls Gemini."""
    monkeypatch.setenv("ENABLE_GEMINI_FINANCIAL_PLANS", "false")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    # Guard: if the service tried to call Gemini it would need a client/network.
    called = {"gemini": False}

    def fake_genai_client(*args, **kwargs):
        called["gemini"] = True
        raise AssertionError("Gemini must not be called when AI is disabled")

    monkeypatch.setattr(ai_financial_planner.genai, "Client", fake_genai_client)

    request = PersonalizedPlanRequest(
        monthly_investment_amount=500,
        risk_tolerance=RiskTolerance.MODERATE,
        financial_goal=FinancialGoal.WEALTH_BUILDING,
        time_horizon_years=10,
        current_savings=1000,
        has_emergency_fund=True,
        loans=[
            {
                "loan_type": "credit_card",
                "loan_name": "Visa",
                "principal": 5000,
                "interest_rate": 0.22,
                "minimum_payment": 150,
            }
        ],
        age=30,
        notes="Aggressive saver",
    )

    plan = generate_ai_financial_plan(request)

    assert not called["gemini"]
    assert plan.portfolio_name
    assert plan.target_allocation
    assert any(
        "AI plan generation is disabled" in warning for warning in (plan.warnings or [])
    )


def test_generate_ai_financial_plan_raises_without_key_when_enabled(monkeypatch):
    """When AI is enabled but no key is configured, the service surfaces a
    clear runtime error rather than silently falling back."""
    monkeypatch.setenv("ENABLE_GEMINI_FINANCIAL_PLANS", "true")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    request = PersonalizedPlanRequest(monthly_investment_amount=500)

    try:
        generate_ai_financial_plan(request)
        assert False, "expected RuntimeError for missing GEMINI_API_KEY"
    except RuntimeError as exc:
        assert "GEMINI_API_KEY" in str(exc)


def test_generate_ai_financial_plan_uses_json_mode_without_developer_api_schema(monkeypatch):
    """Gemini Developer API rejects Pydantic dict schemas because they emit
    additionalProperties. Keep JSON mode, put the schema in the prompt, and
    do not send response_schema in GenerateContentConfig."""
    baseline = _sample_plan()
    captured = {}

    class FakeModels:
        def generate_content(self, *, model, contents, config):
            captured["model"] = model
            captured["contents"] = contents
            captured["config"] = config

            class FakeResponse:
                text = baseline.model_dump_json()

            return FakeResponse()

    class FakeClient:
        def __init__(self, *, api_key):
            captured["api_key"] = api_key
            self.models = FakeModels()

    monkeypatch.setenv("ENABLE_GEMINI_FINANCIAL_PLANS", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(ai_financial_planner.personalized_planner, "generate_personalized_plan", lambda request: baseline)
    monkeypatch.setattr(ai_financial_planner.genai, "Client", FakeClient)

    plan = generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))

    assert plan.portfolio_name == "Mock Portfolio"
    assert captured["api_key"] == "test-key"
    assert "OUTPUT_JSON_SCHEMA" in captured["contents"]
    assert "INPUT_JSON" in captured["contents"]
    assert getattr(captured["config"], "response_mime_type") == "application/json"
    assert getattr(captured["config"], "response_schema", None) is None


def test_personalized_plan_result_accepts_advisor_dashboard_fields():
    from app.models.schemas import PersonalizedPlanResult

    payload = {
        "portfolio_name": "AI Goal-Based Growth Plan",
        "risk_profile": "Aggressive, goal-aware",
        "target_allocation": [],
        "monthly_investment_breakdown": {},
        "projected_value_1yr": 12000,
        "projected_value_5yr": 80000,
        "projected_value_10yr": 210000,
        "projected_value_20yr": 800000,
        "projected_value_30yr": 1800000,
        "expected_annual_return": 8.1,
        "portfolio_expense_ratio": 0.05,
        "rebalancing_frequency": "Quarterly",
        "reasoning": ["Goal and risk tolerance support growth tilt."],
        "next_steps": ["Automate monthly investing."],
        "warnings": ["Educational guidance only."],
        "advisor_summary": "Prioritize investing while keeping liquidity safe.",
        "advisor_cards": [
            {
                "title": "Investing Priority",
                "priority": 1,
                "category": "investing",
                "recommendation": "Invest most of the monthly surplus into diversified ETFs.",
                "rationale": "The user selected aggressive risk and income generation.",
                "action_items": ["Set up recurring contributions."],
                "monthly_amount": 800,
                "confidence": "high",
            }
        ],
        "monthly_action_plan": {
            "available_monthly_amount": 1000,
            "etf_investing_amount": 800,
            "debt_extra_payment_amount": 100,
            "emergency_fund_amount": 100,
            "notes": ["Only shown because income/expense context exists."],
        },
        "satellite_stock_ideas": [
            {
                "ticker": "AAPL",
                "name": "Apple Inc.",
                "allocation_percent": 3,
                "monthly_amount": 30,
                "reason": "Optional satellite exposure, not core allocation.",
                "risk_note": "Single-stock risk; cap total satellite exposure.",
            }
        ],
        "advisor_assumptions": {
            "confidence": "medium",
            "data_used": ["loans", "income", "goal", "emergency fund"],
            "missing_data": ["tax filing status"],
            "caveats": ["No professional advice."],
        },
        "plan_source": "ai",
    }

    result = PersonalizedPlanResult.model_validate(payload)

    assert result.advisor_summary.startswith("Prioritize")
    assert result.advisor_cards[0].priority == 1
    assert result.monthly_action_plan.etf_investing_amount == 800
    assert result.satellite_stock_ideas[0].allocation_percent == 3
    assert result.advisor_assumptions.confidence == "medium"
    assert result.plan_source == "ai"


def test_ai_disabled_returns_rule_based_dashboard_fields(monkeypatch):
    from app.models.schemas import FinancialGoal, PersonalizedPlanRequest, RiskTolerance
    from app.services.ai_financial_planner import generate_ai_financial_plan

    monkeypatch.setenv("ENABLE_GEMINI_FINANCIAL_PLANS", "false")

    request = PersonalizedPlanRequest(
        monthly_investment_amount=1000,
        risk_tolerance=RiskTolerance.AGGRESSIVE,
        financial_goal=FinancialGoal.INCOME_GENERATION,
        current_savings=5000,
        has_emergency_fund=False,
        monthly_gross_income=5000,
        monthly_expenses=3200,
        current_emergency_fund=1000,
        emergency_fund_months_target=3,
        loans=[],
    )

    result = generate_ai_financial_plan(request)

    assert result.plan_source == "rule_based"
    assert result.advisor_summary
    assert len(result.advisor_cards) >= 6
    assert any(card.category == "etf_allocation" for card in result.advisor_cards)
    assert any(card.category == "emergency_fund" for card in result.advisor_cards)
    assert result.advisor_assumptions is not None
    assert "rule-based" in " ".join(result.warnings or []).lower()


def test_ai_prompt_requires_advisor_dashboard_sections():
    from pathlib import Path

    source = Path("app/services/ai_financial_planner.py").read_text()

    assert "6 to 8 prioritized advisor cards" in source
    assert "investing and ETF allocation first" in source
    assert "debt and emergency fund guidance" in source
    assert "satellite stock ideas" in source
    assert "monthly_action_plan only when" in source
    assert "advisor_assumptions" in source


def test_sanitize_ai_plan_sets_source_and_limits_satellite_stock_exposure():
    from app.models.schemas import (
        AdvisorCard,
        PersonalizedPlanResult,
        SatelliteStockIdea,
    )
    from app.services.ai_financial_planner import _sanitize_plan

    baseline = PersonalizedPlanResult(
        portfolio_name="Baseline",
        risk_profile="Moderate",
        target_allocation=[],
        monthly_investment_breakdown={"VOO": 1000},
        projected_value_1yr=1,
        projected_value_5yr=5,
        projected_value_10yr=10,
        projected_value_20yr=20,
        projected_value_30yr=30,
        expected_annual_return=7,
        portfolio_expense_ratio=0.05,
        rebalancing_frequency="Quarterly",
        reasoning=["baseline"],
        next_steps=["baseline"],
    )
    ai_plan = baseline.model_copy(deep=True)
    ai_plan.advisor_cards = [
        AdvisorCard(
            title="Investing",
            priority=1,
            category="investing",
            recommendation="Invest monthly.",
            rationale="Goal supports growth.",
        )
    ]
    ai_plan.satellite_stock_ideas = [
        SatelliteStockIdea(
            ticker="XYZ",
            name="Example",
            allocation_percent=25,
            monthly_amount=250,
            reason="Too much risk",
            risk_note="High concentration risk",
        )
    ]

    result = _sanitize_plan(ai_plan, baseline)

    assert result.plan_source == "ai"
    assert len(result.advisor_cards) >= 6
    assert result.satellite_stock_ideas[0].allocation_percent <= 10
    assert result.satellite_stock_ideas[0].monthly_amount <= 100
    assert any("educational" in warning.lower() for warning in result.warnings)
