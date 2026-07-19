import asyncio
import os

from app.models.schemas import FinancialGoal, PersonalizedPlanRequest, RiskTolerance
from app.services import ai_financial_planner
from app.services.ai_financial_planner import generate_ai_financial_plan


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
