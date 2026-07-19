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
