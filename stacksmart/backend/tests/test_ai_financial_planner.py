import json
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace

import pytest
from pydantic import ValidationError
from app.models.schemas import PersonalizedPlanRequest, PersonalizedPlanResult, ETFAllocation
from app.services import ai_financial_planner as ai

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



def _advice(**overrides):
    payload = {
        "advisor_summary": "Review a diversified long-term plan.",
        "advisor_cards": [{"title": "Plan", "priority": i, "category": "investing", "recommendation": "Review allocation.", "rationale": "Matches supplied goals.", "action_items": ["Review."]} for i in range(1,7)],
        "advisor_assumptions": {"confidence": "medium", "data_used": ["risk"], "missing_data": ["tax status"], "caveats": ["Educational."]},
        "proposed_allocation": [{"ticker": "VTI", "percentage": 60, "reason": "US core."}, {"ticker": "VXUS", "percentage": 20, "reason": "Diversification."}, {"ticker": "BND", "percentage": 20, "reason": "Defensive allocation."}],
        "stock_idea": None,
    }
    return {**payload, **overrides}


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setenv("ENABLE_AI_FINANCIAL_PLANS", "true")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MODEL", ai.DEFAULT_AI_MODEL)
    monkeypatch.setattr(ai.personalized_planner, "generate_personalized_plan", lambda request: _sample_plan())
    monkeypatch.setattr(ai, "_verified_stock_candidate", lambda: None)
    monkeypatch.setattr(ai.personalized_planner.market_data_fetcher, "get_cached_etf_data", lambda tickers: {ticker: {"price": 100, "expense_ratio": .03} for ticker in tickers})
    captured = []
    def respond(body=None, status=200, format="tool"):
        def post(url, **kwargs):
            captured.append({"url": url, **kwargs})
            args = json.dumps(body if body is not None else _advice())
            message = {"content": args} if format == "text" else {"tool_calls": [{"function": {"name": "submit_financial_advice", "arguments": args}}]}
            return SimpleNamespace(ok=status == 200, status_code=status, json=lambda: {"choices": [{"finish_reason": "stop", "message": message}]})
        monkeypatch.setattr(ai.requests, "post", post)
    respond()
    return captured, respond


@pytest.mark.parametrize("format", ["tool", "text"])
def test_exact_free_model_and_validated_allocation(provider, format):
    captured, respond = provider
    respond(format=format)
    result = ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))
    request = captured[0]
    assert request["url"] == ai.OPENROUTER_URL
    assert request["json"]["model"] == ai.DEFAULT_AI_MODEL
    assert request["json"]["provider"]["max_price"] == {"prompt": 0, "completion": 0}
    assert request["json"]["tool_choice"]["function"]["name"] == "submit_financial_advice"
    assert request["json"]["reasoning"] == {"enabled": False}
    assert request["timeout"] == (5, 60)
    assert [item.ticker for item in result.target_allocation] == ["VTI", "VXUS", "BND"]
    assert sum(item.monthly_amount for item in result.target_allocation) == 500
    assert result.stock_idea_status == "unavailable"
    assert result.ai_model == ai.DEFAULT_AI_MODEL


@pytest.mark.parametrize("allocation", [
    [{"ticker":"BAD", "percentage":100, "reason":"Invalid."}],
    [{"ticker":"VTI", "percentage":60,"reason":"Core."}, {"ticker":"VTI", "percentage":40,"reason":"Duplicate."}],
    [{"ticker":"VTI", "percentage":60,"reason":"Core."}, {"ticker":"VOO", "percentage":40,"reason":"Overlap."}],
    [{"ticker":"VTI", "percentage":99,"reason":"Bad total."}],
    [{"ticker":"VTI", "percentage":float("nan"),"reason":"Nonfinite."}],
])
def test_invalid_etf_output_is_rejected(provider, allocation):
    provider[1](_advice(proposed_allocation=allocation))
    with pytest.raises(ai.AIPlanError, match="invalid or incomplete"):
        ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))


def test_short_horizon_constraints_are_enforced(provider):
    with pytest.raises(ai.AIPlanError):
        ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500,time_horizon_years=2,risk_tolerance="aggressive"))
    provider[1](_advice(proposed_allocation=[{"ticker":"SGOV","percentage":100,"reason":"Short timeline."}]))
    result = ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500,time_horizon_years=2))
    assert result.target_allocation[0].ticker == "SGOV"


def test_current_context_changes_each_request_and_holdings_are_not_added_twice(provider):
    for amount in (100, 500):
        request = PersonalizedPlanRequest(monthly_investment_amount=amount,current_savings=1000,
            existing_holdings=[{"ticker":"vti", "current_value":1000}])
        result = ai.generate_ai_financial_plan(request)
        expected = ai.personalized_planner.calculate_future_value(1000,amount,result.expected_annual_return/100,1)
        assert result.projected_value_1yr == round(expected,2)
    inputs = [json.loads(call["json"]["messages"][1]["content"].split("INPUT_JSON: ")[1])["user_inputs"] for call in provider[0]]
    assert [item["monthly_investment_amount"] for item in inputs] == [100,500]
    assert all(set(item) == {"monthly_investment_amount", "risk_tolerance"} for item in inputs)


def test_liquidity_budget_and_projection_use_one_cash_reserve(provider):
    result = ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500,current_savings=1000,
        liquidity_needs=[{"amount":3400,"months_until_needed":12,"purpose":"Tuition"}]))
    action = result.monthly_action_plan
    assert action.liquidity_savings_amount == 200
    assert action.etf_investing_amount == 300
    assert sum(item.monthly_amount for item in result.target_allocation) == 300
    assert action.etf_investing_amount + action.emergency_fund_amount + action.debt_extra_payment_amount + action.liquidity_savings_amount == 500
    assert result.projected_value_1yr == round(ai.personalized_planner.calculate_future_value(0,300,result.expected_annual_return/100,1),2)


def test_dollars_reconcile_to_the_cent(provider):
    provider[1](_advice(proposed_allocation=[{"ticker":"VTI","percentage":33.33,"reason":"Core."},{"ticker":"VXUS","percentage":33.33,"reason":"International."},{"ticker":"BND","percentage":33.34,"reason":"Bonds."}]))
    result = ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=100.01))
    assert sum(round(item.monthly_amount*100) for item in result.target_allocation) == 10001


def test_only_verified_stock_is_used_without_budget(provider, monkeypatch):
    candidate = {"ticker":"NVDA","name":"NVIDIA Corporation","sector":"Technology","as_of":"2026-11-06","supporting_context":"Dated screen selected this company."}
    monkeypatch.setattr(ai,"_verified_stock_candidate",lambda:candidate)
    provider[1](_advice(stock_idea={"ticker":"NVDA","reason":"Screen selected it.","risk_note":"Concentration risk."}))
    plan = ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500,risk_tolerance="aggressive"))
    idea = plan.satellite_stock_ideas[0]
    assert idea.allocation_percent == idea.monthly_amount == 0
    assert idea.sector == "Technology" and plan.stock_idea_status == "available"
    provider[1](_advice(stock_idea={"ticker":"AAPL","reason":"Wrong pick.","risk_note":"Risk."}))
    with pytest.raises(ai.AIPlanError):
        ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500,risk_tolerance="aggressive"))


@pytest.mark.parametrize("status", [401,429,503])
def test_provider_errors_have_safe_category_and_reference(provider,status):
    provider[1](status=status)
    with pytest.raises(ai.AIPlanError) as caught:
        ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))
    assert caught.value.reference and caught.value.category.startswith("provider_")
    assert "test-key" not in str(caught.value)


def test_timeout_has_no_alternate_model_retry(provider,monkeypatch):
    monkeypatch.setenv("OPENROUTER_FALLBACK_MODEL","paid/other")
    calls=[]
    def fail(*args,**kwargs):
        calls.append(kwargs)
        raise ai.requests.Timeout("secret data")
    monkeypatch.setattr(ai.requests,"post",fail)
    with pytest.raises(ai.AIPlanError,match="timeout") as caught:
        ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))
    assert len(calls)==1 and "secret" not in str(caught.value)


@pytest.mark.parametrize("payload", [
    {"monthly_investment_amount":float("inf")},
    {"monthly_investment_amount":500,"existing_holdings":[{"ticker":"VTI","current_value":1}]},
    {"monthly_investment_amount":500,"liquidity_needs":[{"amount":20,"months_until_needed":1.5,"purpose":"Goal"}]},
])
def test_invalid_user_financial_inputs_rejected(payload):
    with pytest.raises(ValidationError):
        PersonalizedPlanRequest(**payload)


def test_disabled_rulebased_still_preserves_liquidity(provider,monkeypatch):
    monkeypatch.setenv("ENABLE_AI_FINANCIAL_PLANS","false")
    plan=ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500,time_horizon_years=2,
        liquidity_needs=[{"amount":100,"months_until_needed":0,"purpose":"Now"}]))
    assert plan.plan_source == "rule_based"
    assert plan.target_allocation[0].ticker == "SGOV"
    assert plan.monthly_action_plan.etf_investing_amount == 400


@pytest.mark.parametrize("body",[{"error":{"message":"secret"}},{"choices":[]},{"choices":[{"finish_reason":"length","message":{"content":"{}"}}]},{"choices":[{"finish_reason":"stop","message":{"content":"not JSON"}}]}])
def test_malformed_or_truncated_provider_responses(provider,monkeypatch,body):
    monkeypatch.setattr(ai.requests,"post",lambda *args,**kwargs:SimpleNamespace(ok=True,json=lambda:body))
    with pytest.raises(ai.AIPlanError,match="invalid or incomplete"):
        ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))


def test_stale_future_and_unknown_stock_candidates_are_unavailable(monkeypatch):
    monkeypatch.setattr(ai,"get_planning_storage_client",lambda:object())
    today=datetime.now(timezone.utc).date()
    for pick in [None,{"ticker":"UNKNOWN","pick_date":today.isoformat()},
                 {"ticker":"NVDA","pick_date":(today-timedelta(days=8)).isoformat()},
                 {"ticker":"NVDA","pick_date":(today+timedelta(days=1)).isoformat()}]:
        monkeypatch.setattr(ai.stock_of_the_day_query_service,"get_latest_pick",lambda **kwargs:pick)
        assert ai._verified_stock_candidate() is None
    monkeypatch.setattr(ai.stock_of_the_day_query_service,"get_latest_pick",lambda **kwargs:{"ticker":"NVDA","pick_date":today.isoformat(),"composite_score":1.2,"factor_breakdown":{"momentum":{"raw_value":.2}}})
    candidate=ai._verified_stock_candidate()
    assert candidate["ticker"]=="NVDA" and candidate["as_of"]==today.isoformat()


def test_demo_returns_are_not_displayed_as_live_results(provider,monkeypatch):
    monkeypatch.setattr(ai.personalized_planner.market_data_fetcher,"get_cached_etf_data",lambda tickers:{ticker:{"price":100,"data_source":"Demo Mode","ytd_return":25,"one_year_return":25} for ticker in tickers})
    plan=ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))
    assert all(item.ytd_return is None and item.one_year_return is None for item in plan.target_allocation)
    assert any("illustrative" in warning for warning in plan.warnings)


@pytest.mark.parametrize("field,value",[("principal",float("inf")),("minimum_payment",float("nan")),("principal",1e13),("loan_name","x"*121),("term_months",1201)])
def test_planning_loan_fields_are_finite_and_bounded(field,value):
    loan={"principal":1000,"minimum_payment":20,"interest_rate":.05,field:value}
    with pytest.raises(ValidationError):
        PersonalizedPlanRequest(monthly_investment_amount=500,loans=[loan])


def test_planning_loan_count_is_bounded():
    with pytest.raises(ValidationError):
        PersonalizedPlanRequest(monthly_investment_amount=500,loans=[{"principal":1000,"minimum_payment":20,"interest_rate":.05}]*51)


def test_capital_preservation_rejects_equity_only_even_at_long_horizon(provider):
    provider[1](_advice(proposed_allocation=[{"ticker":"VTI","percentage":80,"reason":"Core."},{"ticker":"VXUS","percentage":20,"reason":"International."}]))
    with pytest.raises(ai.AIPlanError):
        ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500,financial_goal="capital_preservation",time_horizon_years=10))


def test_disabled_fallback_is_goal_sensitive_and_debt_freedom_prioritizes_lower_rate_debt(provider,monkeypatch):
    monkeypatch.setenv("ENABLE_AI_FINANCIAL_PLANS","false")
    building=ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500,financial_goal="wealth_building"))
    preservation=ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500,financial_goal="capital_preservation"))
    defensive=lambda plan:sum(item.percentage for item in plan.target_allocation if item.ticker in {"BND","SGOV"})
    assert defensive(preservation)>=80 and defensive(preservation)>defensive(building)
    request=PersonalizedPlanRequest(monthly_investment_amount=500,financial_goal="debt_freedom",has_emergency_fund=True,
        loans=[{"principal":1000,"minimum_payment":20,"interest_rate":.03}])
    action=ai._monthly_action_plan(request)
    assert action.debt_extra_payment_amount==500 and action.etf_investing_amount==0


def test_generation_never_downloads_live_quotes(provider,monkeypatch):
    monkeypatch.setattr(ai.personalized_planner.market_data_fetcher,"get_multiple_etf_data",lambda *args:pytest.fail("No live quote jobs during generation"))
    monkeypatch.setattr(ai.personalized_planner.market_data_fetcher,"get_cached_etf_data",lambda *args:{})
    plan=ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500))
    assert any("illustrative" in warning for warning in plan.warnings)
    assert all(item.current_price>0 for item in plan.target_allocation)


def test_planning_storage_transport_is_short_and_disables_retries(monkeypatch):
    from app.services import planning_storage
    captured={}
    monkeypatch.setattr(planning_storage,"create_client",lambda *args,**kwargs:captured.update(kwargs) or object())
    planning_storage.get_supabase_client()
    options=captured["options"]
    assert options.postgrest_client_timeout==5
    if hasattr(options,"postgrest_client_retry"):
        assert options.postgrest_client_retry is False
    assert options.auto_refresh_token is False


def test_low_risk_uses_savings_without_provider_or_stock_lookup(provider, monkeypatch):
    monkeypatch.setattr(ai, "_verified_stock_candidate", lambda: pytest.fail("No stock lookup for low risk"))
    plan = ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=250, risk_tolerance="conservative"))
    assert plan.savings_recommendation.monthly_amount == 250
    assert plan.target_allocation == [] and plan.satellite_stock_ideas == []
    assert plan.ai_model is None and provider[0] == []
    assert "variable APY" in plan.savings_recommendation.risk_note


def test_balanced_does_not_request_individual_stocks(provider, monkeypatch):
    monkeypatch.setattr(ai, "_verified_stock_candidate", lambda: pytest.fail("No stock lookup for balanced risk"))
    plan = ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=250))
    assert plan.satellite_stock_ideas == []
    schema = provider[0][0]["json"]["tools"][0]["function"]["parameters"]
    assert "advisor_cards" not in schema["properties"]
    assert "advisor_assumptions" not in schema["properties"]


def test_disabled_higher_risk_has_more_equity_exposure(provider, monkeypatch):
    monkeypatch.setenv("ENABLE_AI_FINANCIAL_PLANS", "false")
    balanced = ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500, risk_tolerance="moderate"))
    higher = ai.generate_ai_financial_plan(PersonalizedPlanRequest(monthly_investment_amount=500, risk_tolerance="aggressive"))
    equity = lambda plan: sum(item.percentage for item in plan.target_allocation if item.ticker in {"VTI", "VOO", "VXUS"})
    assert equity(higher) > equity(balanced)
