import httpx2
import pytest

from app.llm import LLMUnavailable
from tests.fakes import MockAPI, api_message


def test_moderate_sends_structured_request_and_parses():
    api = MockAPI((200, api_message({"decision": "flag", "reasons": ["names a student"]})))
    result = api.llm().moderate("Long enough review text here.", ["https://example.com/a.webp"])
    assert result.decision == "flag"
    assert result.reasons == ["names a student"]

    body = api.requests[0]
    assert body["model"] == "claude-haiku-5-5"
    assert body["output_config"]["effort"] == "low"
    assert body["output_config"]["format"]["type"] == "json_schema"
    content = body["messages"][0]["content"]
    assert content[0] == {"type": "image", "source": {"type": "url", "url": "https://example.com/a.webp"}}
    assert "<review>" in content[-1]["text"]
    assert "temperature" not in body and "thinking" not in body


def test_summary_schema_has_every_category():
    payload = {
        "overview": "Mixed.",
        "categories": {k: None for k in ("food", "surroundings", "social", "education", "prices", "dorm", "campus")},
    }
    payload["categories"]["food"] = {"pros": ["tasty"], "cons": []}
    api = MockAPI((200, api_message(payload)))
    result = api.llm().summarize("Boston", [{"comment": "Food is great here.", "attended_term": "Fall 2025", "review_ratings": []}])
    assert result.categories.food.pros == ["tasty"]
    assert result.categories.dorm is None
    schema = api.requests[0]["output_config"]["format"]["schema"]
    assert "categories" in schema["properties"] or "$defs" in schema


def test_refusal_raises_unavailable():
    api = MockAPI((200, api_message(stop_reason="refusal", stop_details={"type": "refusal", "category": "cyber", "explanation": None})))
    with pytest.raises(LLMUnavailable, match="declined"):
        api.llm().moderate("Long enough review text here.", [])


def test_truncated_output_raises_unavailable():
    api = MockAPI((200, api_message(stop_reason="max_tokens", text='{"decision": "appr')))
    with pytest.raises(LLMUnavailable):
        api.llm().moderate("Long enough review text here.", [])


def test_api_errors_raise_unavailable():
    for status in (429, 500, 400):
        api = MockAPI((status, {"type": "error", "error": {"type": "api_error", "message": "boom"}}))
        with pytest.raises(LLMUnavailable):
            api.llm().moderate("Long enough review text here.", [])


def test_connection_error_raises_unavailable():
    api = MockAPI((0, httpx2.ConnectError("down")))
    with pytest.raises(LLMUnavailable, match="reach"):
        api.llm().moderate("Long enough review text here.", [])
