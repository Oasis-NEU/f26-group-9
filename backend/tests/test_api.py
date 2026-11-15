import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SUPABASE_URL", "http://supabase.test")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("WEBHOOK_SECRET", "s3cret")

from app import main  # noqa: E402
from app.llm import ModerationResult  # noqa: E402
from tests.fakes import FakeRepo  # noqa: E402
from tests.test_pipeline import RECORD, StubLLM, _summary  # noqa: E402


@pytest.fixture
def env():
    repo = FakeRepo(approved=3)
    llm = StubLLM(moderation=ModerationResult(decision="approve", reasons=[]), summary=_summary())
    main.app.dependency_overrides[main.get_repo] = lambda: repo
    main.app.dependency_overrides[main.get_llm] = lambda: llm
    yield TestClient(main.app), repo, llm
    main.app.dependency_overrides.clear()


def hook(client, payload, secret="s3cret"):
    return client.post("/webhooks/reviews", json=payload, headers={"X-Webhook-Secret": secret})


def test_rejects_bad_secret(env):
    client, repo, _ = env
    assert hook(client, {"type": "INSERT", "table": "reviews", "record": RECORD}, secret="nope").status_code == 401
    assert client.post("/webhooks/reviews", json={}).status_code == 401
    assert repo.moderation_calls == []


def test_pending_insert_is_moderated(env):
    client, repo, _ = env
    r = hook(client, {"type": "INSERT", "table": "reviews", "record": {**RECORD, "status": "pending"}, "old_record": None})
    assert r.status_code == 202 and r.json() == {"action": "moderate"}
    assert repo.moderation_calls[0][2] == "approved"  # background task ran


def test_approval_triggers_summary_check(env):
    client, repo, llm = env
    r = hook(client, {"type": "UPDATE", "table": "reviews",
                      "record": {**RECORD, "status": "approved"}, "old_record": {**RECORD, "status": "flagged"}})
    assert r.json() == {"action": "summary-check"}
    assert len(repo.summaries) == 1


def test_already_approved_update_is_ignored(env):
    client, repo, llm = env
    r = hook(client, {"type": "UPDATE", "table": "reviews",
                      "record": {**RECORD, "status": "approved"}, "old_record": {**RECORD, "status": "approved"}})
    assert r.json() == {"action": "ignored"}
    assert llm.calls == []


def test_rejected_and_delete_ignored(env):
    client, _, llm = env
    assert hook(client, {"type": "UPDATE", "table": "reviews", "record": {**RECORD, "status": "rejected"}, "old_record": {}}).json()["action"] == "ignored"
    assert hook(client, {"type": "DELETE", "table": "reviews", "record": None, "old_record": RECORD}).json()["action"] == "ignored"
    assert llm.calls == []


def test_admin_summary_requires_admin(env):
    client, repo, _ = env
    assert client.post("/admin/summaries/1").status_code == 401
    assert client.post("/admin/summaries/1", headers={"Authorization": "Bearer bad"}).status_code == 401
    assert client.post("/admin/summaries/1", headers={"Authorization": "Bearer user-token"}).status_code == 403
    r = client.post("/admin/summaries/1", headers={"Authorization": "Bearer good-token"})
    assert r.status_code == 200 and r.json() == {"updated": True}


def test_health(env):
    client, _, _ = env
    assert client.get("/health").json() == {"ok": True}
