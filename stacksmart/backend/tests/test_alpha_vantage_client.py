"""Unit tests for the Alpha Vantage HTTP client's failure handling."""

import pytest

from app.services import alpha_vantage_client as client


class _FakeResponse:
    def __init__(self, json_data, status_ok=True):
        self._json_data = json_data
        self._status_ok = status_ok

    def raise_for_status(self):
        if not self._status_ok:
            raise Exception("HTTP error")

    def json(self):
        return self._json_data


class TestFetchNewsSentimentRaw:
    def test_returns_data_on_success(self, monkeypatch):
        monkeypatch.setattr(
            client.requests, "get", lambda *a, **k: _FakeResponse({"feed": [{"foo": "bar"}]})
        )
        result = client.fetch_news_sentiment_raw("AAPL")
        assert result == {"feed": [{"foo": "bar"}]}

    def test_raises_on_network_failure(self, monkeypatch):
        def raise_error(*a, **k):
            raise Exception("connection reset")

        monkeypatch.setattr(client.requests, "get", raise_error)

        with pytest.raises(client.AlphaVantageError):
            client.fetch_news_sentiment_raw("AAPL")

    def test_raises_on_rate_limit_payload(self, monkeypatch):
        monkeypatch.setattr(
            client.requests,
            "get",
            lambda *a, **k: _FakeResponse({"Note": "Thank you for using Alpha Vantage! Our standard API rate limit is..."}),
        )

        with pytest.raises(client.AlphaVantageError):
            client.fetch_news_sentiment_raw("AAPL")

    def test_raises_on_error_message_payload(self, monkeypatch):
        monkeypatch.setattr(
            client.requests,
            "get",
            lambda *a, **k: _FakeResponse({"Error Message": "Invalid API call"}),
        )

        with pytest.raises(client.AlphaVantageError):
            client.fetch_news_sentiment_raw("AAPL")
