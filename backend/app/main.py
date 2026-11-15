"""NUwhere backend: moderation webhook + AI summaries.

Supabase Database Webhook (table `reviews`, INSERT + UPDATE) -> POST /webhooks/reviews
"""

import hmac
import logging
from functools import lru_cache

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings
from .llm import LLM
from .pipeline import moderate_review, regenerate_summary
from .repo import Repo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()


@lru_cache
def get_repo() -> Repo:
    s = get_settings()
    return Repo(s.supabase_url, s.supabase_service_role_key)


@lru_cache
def get_llm() -> LLM:
    return LLM()


def create_app() -> FastAPI:
    app = FastAPI(title="NUwhere backend")
    try:
        origins = get_settings().frontend_origins
    except RuntimeError:
        origins = []  # settings errors surface on first request instead of at import
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.post("/webhooks/reviews", status_code=202)
    def review_webhook(
        payload: dict,
        background: BackgroundTasks,
        x_webhook_secret: str = Header(default=""),
        settings: Settings = Depends(get_settings),
        repo: Repo = Depends(get_repo),
        llm: LLM = Depends(get_llm),
    ):
        if not hmac.compare_digest(x_webhook_secret, settings.webhook_secret):
            raise HTTPException(401, "bad webhook secret")

        event = payload.get("type")
        record = payload.get("record") or {}
        old = payload.get("old_record") or {}
        if payload.get("table") != "reviews" or not record.get("id"):
            return {"action": "ignored"}

        # Webhooks time out quickly, so acknowledge now and do the slow work after responding.
        if event in ("INSERT", "UPDATE") and record.get("status") == "pending":
            background.add_task(moderate_review, record, repo, llm)
            return {"action": "moderate"}

        # Covers both our own auto-approvals and admin approvals from the flagged queue.
        if event == "UPDATE" and record.get("status") == "approved" and old.get("status") != "approved":
            background.add_task(regenerate_summary, record["location_id"], repo, llm)
            return {"action": "summary-check"}

        return {"action": "ignored"}

    @app.post("/admin/summaries/{location_id}")
    def force_summary(
        location_id: int,
        authorization: str = Header(default=""),
        repo: Repo = Depends(get_repo),
        llm: LLM = Depends(get_llm),
    ):
        token = authorization.removeprefix("Bearer ").strip()
        user_id = repo.user_id_from_jwt(token) if token else None
        if not user_id:
            raise HTTPException(401, "sign in required")
        if not repo.is_admin(user_id):
            raise HTTPException(403, "admins only")
        updated = regenerate_summary(location_id, repo, llm, force=True)
        return {"updated": updated}

    return app


app = create_app()
