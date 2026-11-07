import threading
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app import main
from app.middleware.auth import verify_user_token
from app.services.ai_financial_planner import AIPlanError
from tests.test_ai_financial_planner import _sample_plan


@pytest.fixture
def planning_client(monkeypatch):
    previous = dict(main.app.dependency_overrides)
    main.app.dependency_overrides[verify_user_token] = lambda: "synthetic-user"
    reserve = AsyncMock(return_value="synthetic-generation")
    complete = AsyncMock()
    release = AsyncMock()
    monkeypatch.setattr(main, "reserve_daily_generation", reserve)
    monkeypatch.setattr(main, "complete_daily_generation", complete)
    monkeypatch.setattr(main, "release_failed_generation", release)
    with TestClient(main.app) as client:
        yield client, reserve, complete, release
    main.app.dependency_overrides.clear()
    main.app.dependency_overrides.update(previous)


def test_timeout_returns_cors_json_and_releases_quota(planning_client, monkeypatch):
    client, reserve, complete, release = planning_client
    def generate(request):
        raise AIPlanError("The AI provider took too long to respond. Please try again shortly.", 504)
    monkeypatch.setattr(main.ai_financial_planner, "generate_ai_financial_plan", generate)
    response = client.post("/api/plan/generate", json={"monthly_investment_amount": 300}, headers={"Origin": "https://stacksmart.dev"})
    assert response.status_code == 504
    assert "took too long" in response.json()["detail"]
    assert response.headers["access-control-allow-origin"] == "https://stacksmart.dev"
    reserve.assert_awaited_once()
    complete.assert_not_awaited()
    release.assert_awaited_once()


def test_generation_runs_off_event_loop_and_persists_once(planning_client, monkeypatch):
    client, reserve, complete, release = planning_client
    threads = {}
    async def reserve_generation(**kwargs):
        threads["event_loop"] = threading.get_ident()
        return "synthetic-generation"
    reserve.side_effect = reserve_generation
    def generate(request):
        threads["generation"] = threading.get_ident()
        return _sample_plan()
    monkeypatch.setattr(main.ai_financial_planner, "generate_ai_financial_plan", generate)
    response = client.post("/api/plan/generate", json={"monthly_investment_amount": 300})
    assert response.status_code == 200
    assert threads["generation"] != threads["event_loop"]
    complete.assert_awaited_once()
    release.assert_not_awaited()


@pytest.mark.parametrize("origin", [
    "https://stacksmart.dev", "https://www.stacksmart.dev",
    "https://frat-finance.vercel.app",
    "https://stacksmart-shanes-projects-0e41aad5.vercel.app",
    "https://stacksmart-git-main-shanes-projects-0e41aad5.vercel.app",
])
def test_production_origins_can_preflight_authenticated_planning(planning_client, origin):
    client, *_ = planning_client
    response = client.options("/api/plan/generate", headers={
        "Origin": origin, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_unrecognized_origin_is_not_allowed(planning_client):
    client, *_ = planning_client
    response = client.options("/api/plan/generate", headers={
        "Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_twelve_generations_are_accepted_without_daily_quota(planning_client,monkeypatch):
    client,reserve,complete,release=planning_client
    monkeypatch.setattr(main.ai_financial_planner,"generate_ai_financial_plan",lambda request:_sample_plan())
    for _ in range(12):
        response=client.post("/api/plan/generate",json={"monthly_investment_amount":300})
        assert response.status_code==200
    assert reserve.await_count==complete.await_count==12
    release.assert_not_awaited()


def test_status_uses_verified_user_and_unlimited_contract(planning_client,monkeypatch):
    client,*_=planning_client
    status=AsyncMock(return_value={"unlimited":True,"limit":None,"remaining":None,"used_today":False,"used_count":12,"generation":None})
    monkeypatch.setattr(main,"get_generation_status",status)
    response=client.get("/api/plan/generate/status")
    assert response.status_code==200 and response.json()["unlimited"] is True
    status.assert_awaited_once_with("synthetic-user")


@pytest.mark.parametrize("path,method",[("/api/plan/generate","post"),("/api/plan/generate/status","get")])
def test_planning_requires_authentication(monkeypatch,path,method):
    previous=dict(main.app.dependency_overrides)
    main.app.dependency_overrides.pop(verify_user_token,None)
    reserve=AsyncMock()
    monkeypatch.setattr(main,"reserve_daily_generation",reserve)
    try:
        with TestClient(main.app) as client:
            response=client.post(path,json={"monthly_investment_amount":300}) if method=="post" else client.get(path)
        assert response.status_code==401
        reserve.assert_not_awaited()
    finally:
        main.app.dependency_overrides.clear()
        main.app.dependency_overrides.update(previous)


@pytest.mark.parametrize("loan",[
    {"principal":1e13,"minimum_payment":20,"interest_rate":.05},
    {"principal":1000,"minimum_payment":20,"interest_rate":.05,"loan_name":"x"*121},
])
def test_invalid_nested_planning_loans_return_422(planning_client,loan):
    client,reserve,*_=planning_client
    response=client.post("/api/plan/generate",json={"monthly_investment_amount":500,"loans":[loan]})
    assert response.status_code==422
    reserve.assert_not_awaited()


def test_nonfinite_nested_loan_is_rejected_before_provider(planning_client):
    # Valid JSON numeric syntax can overflow to infinity in Python. The planning
    # validation handler must reject it without echoing a nonfinite JSON value.
    client,reserve,*_=planning_client
    response=client.post("/api/plan/generate",content='{"monthly_investment_amount":500,"loans":[{"principal":1e309,"minimum_payment":20,"interest_rate":0.05}]}',headers={"Content-Type":"application/json"})
    assert response.status_code==422
    reserve.assert_not_awaited()


@pytest.mark.parametrize("principal,payment", [(0, 0), (1000, 0)])
def test_planning_accepts_paid_or_deferred_saved_loans(planning_client, monkeypatch, principal, payment):
    client, reserve, complete, release = planning_client
    monkeypatch.setattr(main.ai_financial_planner, "generate_ai_financial_plan", lambda request: _sample_plan())
    response = client.post("/api/plan/generate", json={
        "monthly_investment_amount": 300,
        "loans": [{"principal": principal, "minimum_payment": payment, "interest_rate": 0.05}],
    })
    assert response.status_code == 200
    reserve.assert_awaited_once()
    complete.assert_awaited_once()
    release.assert_not_awaited()
