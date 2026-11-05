from types import SimpleNamespace

import pytest

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


def _sample_advice():
    plan = ai_financial_planner._attach_rule_based_advisor_fields(
        _sample_plan(), PersonalizedPlanRequest(monthly_investment_amount=500)
    )
    return ai_financial_planner.AdvisorResponse.model_validate(plan.model_dump()).model_dump_json()


def test_generate_ai_financial_plan_falls_back_when_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_AI_FINANCIAL_PLANS", "false")
    monkeypatch.setattr(ai_financial_planner.personalized_planner, "generate_personalized_plan", lambda request: _sample_plan())
    monkeypatch.setattr(ai_financial_planner.requests, "post", lambda *a, **k: pytest.fail("AI disabled: no provider call expected"))
    result = generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))
    assert result.plan_source == "rule_based"
    assert any("AI plan generation is disabled" in warning for warning in result.warnings)


def test_generate_ai_financial_plan_raises_without_key_when_enabled(monkeypatch):
    monkeypatch.setenv("ENABLE_AI_FINANCIAL_PLANS", "true")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setattr(ai_financial_planner.personalized_planner, "generate_personalized_plan", lambda request: _sample_plan())
    with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY"):
        generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))


@pytest.fixture
def openrouter_setup(monkeypatch):
    monkeypatch.setenv("ENABLE_AI_FINANCIAL_PLANS", "true")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("OPENROUTER_FALLBACK_MODEL", raising=False)
    monkeypatch.setattr(ai_financial_planner.personalized_planner, "generate_personalized_plan", lambda request: _sample_plan())


@pytest.mark.parametrize("format", ["json", "fenced", "tool"])
def test_openrouter_request_and_validated_response(monkeypatch, openrouter_setup, format):
    captured = {}
    content = _sample_advice()
    if format == "fenced":
        content = "```json\n" + content + "\n```"
    def post(url, **kwargs):
        captured.update(url=url, **kwargs)
        message = {"content": content}
        if format == "tool":
            message = {"tool_calls": [{"function": {"name": "submit_financial_advice", "arguments": content}}]}
        return SimpleNamespace(ok=True, json=lambda: {"choices": [{"finish_reason": "tool_calls" if format == "tool" else "stop", "message": message}]})
    monkeypatch.setattr(ai_financial_planner.requests, "post", post)
    result = generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))
    assert result.plan_source == "ai"
    assert captured["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["json"]["model"] == ai_financial_planner.DEFAULT_AI_MODEL
    assert captured["json"]["provider"]["max_price"] == {"prompt": 0, "completion": 0}
    assert "models" not in captured["json"]
    assert captured["json"]["tool_choice"]["function"]["name"] == "submit_financial_advice"
    assert captured["json"]["reasoning"] == {"enabled": False}
    assert captured["json"]["tools"][0]["function"]["parameters"]["required"]
    assert result.target_allocation == _sample_plan().target_allocation
    assert result.projected_value_30yr == _sample_plan().projected_value_30yr
    assert captured["timeout"] == (10, 45)


@pytest.mark.parametrize("body", [
    {"error": {"message": "provider failure"}},
    {"choices": []},
    {"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]},
    {"choices": [{"finish_reason": "stop", "message": {"content": None}}]},
    {"choices": [{"finish_reason": "stop", "message": {"content": "not JSON"}}]},
    {"choices": [{"finish_reason": "stop", "message": {"content": "{}"}}]},
])
def test_invalid_provider_response_raises(monkeypatch, openrouter_setup, body):
    monkeypatch.setattr(ai_financial_planner.requests, "post", lambda *a, **k: SimpleNamespace(ok=True, json=lambda: body))
    with pytest.raises(RuntimeError, match="invalid or incomplete"):
        generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))


@pytest.mark.parametrize("status", [401, 429, 503])
def test_provider_http_errors_do_not_expose_body(monkeypatch, openrouter_setup, status):
    monkeypatch.setattr(ai_financial_planner.requests, "post", lambda *a, **k: SimpleNamespace(ok=False, status_code=status, text="secret provider details"))
    with pytest.raises(RuntimeError, match="rate-limited" if status == 429 else f"HTTP {status}") as error:
        generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))
    assert "secret" not in str(error.value)


def test_provider_timeout_raises(monkeypatch, openrouter_setup):
    def post(*args, **kwargs):
        raise ai_financial_planner.requests.Timeout("secret request details")
    monkeypatch.setattr(ai_financial_planner.requests, "post", post)
    with pytest.raises(RuntimeError, match="took too long") as error:
        generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))
    assert "secret" not in str(error.value)


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

    monkeypatch.setenv("ENABLE_AI_FINANCIAL_PLANS", "false")
    monkeypatch.setattr(ai_financial_planner.personalized_planner, "generate_personalized_plan", lambda request: _sample_plan())

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


def test_ai_prompt_contains_financial_context_without_requiring_calculation_output():
    request = PersonalizedPlanRequest(monthly_investment_amount=300, notes="Synthetic goal", monthly_expenses=1000)
    payload = ai_financial_planner._request_payload(request, _sample_plan())
    assert payload["user_inputs"]["monthly_investment_amount"] == 300
    assert payload["user_inputs"]["notes"] == "Synthetic goal"
    assert "allocation" in payload["deterministic_baseline"]
    assert "projected_value_30yr" not in payload["deterministic_baseline"]
    schema = ai_financial_planner.AdvisorResponse.model_json_schema()
    assert "target_allocation" not in schema["properties"]
    assert schema["properties"]["advisor_cards"]["minItems"] == 6


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


@pytest.mark.parametrize("invalid", [float("nan"), float("inf"), float("-inf"), None])
def test_nonfinite_market_data_can_be_persisted_as_json(monkeypatch, invalid):
    import json
    from app.services import personalized_planner
    monkeypatch.setenv("ENABLE_AI_FINANCIAL_PLANS", "false")
    monkeypatch.setattr(personalized_planner.market_data_fetcher, "get_multiple_etf_data", lambda tickers: {
        ticker: {"price": invalid, "expense_ratio": invalid, "ytd_return": invalid, "one_year_return": invalid}
        for ticker in tickers
    })
    plan = generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=300))
    json.dumps(plan.model_dump(mode="json"), allow_nan=False)
    assert all(etf.current_price > 0 for etf in plan.target_allocation)
    assert all(etf.ytd_return is None and etf.one_year_return is None for etf in plan.target_allocation)
    assert any("illustrative fallback" in warning for warning in plan.warnings)


def test_zero_market_returns_are_preserved(monkeypatch):
    from app.services import personalized_planner
    monkeypatch.setattr(personalized_planner.market_data_fetcher, "get_multiple_etf_data", lambda tickers: {
        ticker: {"price": 100, "expense_ratio": 0, "ytd_return": 0, "one_year_return": 0}
        for ticker in tickers
    })
    plan = personalized_planner.generate_personalized_plan(PersonalizedPlanRequest(monthly_investment_amount=300))
    assert all(etf.ytd_return == 0 and etf.one_year_return == 0 and etf.expense_ratio == 0 for etf in plan.target_allocation)


@pytest.mark.parametrize("bad_amount", [-1, 501, float("inf")])
def test_ai_advice_rejects_invalid_monthly_budget(monkeypatch, openrouter_setup, bad_amount):
    import json
    advice = json.loads(_sample_advice())
    advice["monthly_action_plan"] = {"etf_investing_amount": bad_amount, "debt_extra_payment_amount": 0, "emergency_fund_amount": 0}
    monkeypatch.setattr(ai_financial_planner.requests, "post", lambda *a, **k: SimpleNamespace(ok=True, json=lambda: {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(advice)}}]}))
    with pytest.raises(ai_financial_planner.AIPlanError, match="invalid or incomplete"):
        generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500, monthly_expenses=1000))


@pytest.mark.parametrize("failure", ["timeout", "invalid"])
def test_free_fallback_uses_correct_request_and_preserves_calculations(monkeypatch, openrouter_setup, failure):
    monkeypatch.setenv("OPENROUTER_FALLBACK_MODEL", "openrouter/free")
    calls = []
    def post(url, **kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            if failure == "timeout":
                raise ai_financial_planner.requests.Timeout()
            return SimpleNamespace(ok=True, json=lambda: {"choices": []})
        return SimpleNamespace(ok=True, json=lambda: {"choices": [{"finish_reason": "stop", "message": {"content": _sample_advice()}}]})
    monkeypatch.setattr(ai_financial_planner.requests, "post", post)
    plan = generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))
    assert calls[0]["json"]["model"] == ai_financial_planner.DEFAULT_AI_MODEL
    assert calls[0]["timeout"] == (10, 20)
    assert calls[1]["json"]["model"] == "openrouter/free"
    assert calls[1]["timeout"] == (10, 40)
    assert calls[1]["json"]["reasoning"] == {"enabled": False}
    assert calls[1]["json"]["provider"]["max_price"] == {"prompt": 0, "completion": 0}
    assert plan.ai_model == "openrouter/free"
    assert plan.target_allocation == _sample_plan().target_allocation
    assert any("free fallback" in warning for warning in plan.warnings)


def test_monthly_advice_keeps_portfolio_dollars_and_projections_consistent(monkeypatch, openrouter_setup):
    import json
    advice = json.loads(_sample_advice())
    advice["monthly_action_plan"] = {"etf_investing_amount": 200, "debt_extra_payment_amount": 250, "emergency_fund_amount": 50}
    monkeypatch.setattr(ai_financial_planner.requests, "post", lambda *a, **k: SimpleNamespace(ok=True, json=lambda: {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(advice)}}]}))
    result = generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500, monthly_expenses=1000))
    assert sum(etf.monthly_amount for etf in result.target_allocation) == 200
    assert result.monthly_investment_breakdown == {"VOO": 200}
    assert result.monthly_action_plan.available_monthly_amount == 500
    expected = ai_financial_planner.personalized_planner.calculate_future_value(0, 200, 0.08, 30)
    assert result.projected_value_30yr == round(expected, 2)
