import json

import anthropic
import httpx2

from app.llm import LLM


class FakeRepo:
    def __init__(self, approved=0, last_summary_count=None, photos=None):
        self.approved = approved
        self.last_summary_count = last_summary_count
        self.photos = photos or []
        self.moderation_calls = []
        self.summaries = []
        self.apply_moderation = True
        self.admins = {"admin-id"}
        self.tokens = {"good-token": "admin-id", "user-token": "user-id"}

    def photo_urls(self, review_id):
        return self.photos

    def set_moderation_result(self, review_id, updated_at, status, notes):
        self.moderation_calls.append((review_id, updated_at, status, notes))
        return self.apply_moderation

    def count_approved(self, location_id):
        return self.approved

    def summary_review_count(self, location_id):
        return self.last_summary_count

    def recent_approved(self, location_id, limit):
        return [
            {"comment": "Great food, pricey rent.", "attended_term": "Fall 2025",
             "review_ratings": [{"category": "food", "stars": 5}]}
        ]

    def list_locations(self):
        return [{"id": 1, "name": "Boston"}, {"id": 2, "name": "London"}]

    def location_name(self, location_id):
        return "Boston"

    def upsert_summary(self, location_id, summary, review_count, model):
        self.summaries.append((location_id, summary, review_count, model))

    def user_id_from_jwt(self, jwt):
        return self.tokens.get(jwt)

    def is_admin(self, user_id):
        return user_id in self.admins


def api_message(payload=None, stop_reason="end_turn", text=None, stop_details=None):
    """A Messages API response body as the server would send it."""
    return {
        "id": "msg_test",
        "type": "message",
        "role": "assistant",
        "model": "claude-haiku-5-5",
        "content": [] if stop_reason == "refusal" else [{"type": "text", "text": text if text is not None else json.dumps(payload)}],
        "stop_reason": stop_reason,
        "stop_sequence": None,
        "stop_details": stop_details,
        "usage": {"input_tokens": 10, "output_tokens": 10},
    }


class MockAPI:
    """Serves canned Messages API responses and records request bodies."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.requests = []

    def handler(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(json.loads(request.content))
        status, body = self.responses.pop(0)
        if isinstance(body, Exception):
            raise body
        return httpx2.Response(status, json=body)

    def llm(self) -> LLM:
        client = anthropic.Anthropic(
            api_key="test",
            max_retries=0,
            http_client=httpx2.Client(transport=httpx2.MockTransport(self.handler)),
        )
        return LLM(client)
