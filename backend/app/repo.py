"""All Supabase access for the backend, using the service role key.

Kept behind one small class so the moderation/summary logic can be tested
with an in-memory fake.
"""

from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

PHOTO_BUCKET = "review-photos"


class Repo:
    def __init__(self, url: str, service_role_key: str):
        self.sb: Client = create_client(url, service_role_key)

    def photo_urls(self, review_id: int, expires_in: int = 600) -> list[str]:
        rows = self.sb.table("review_photos").select("storage_path").eq("review_id", review_id).execute().data
        paths = [r["storage_path"] for r in rows]
        if not paths:
            return []
        signed = self.sb.storage.from_(PHOTO_BUCKET).create_signed_urls(paths, expires_in)
        return [s["signedURL"] for s in signed if s.get("signedURL")]

    def set_moderation_result(self, review_id: int, updated_at: str, status: str, notes: str) -> bool:
        """Only applies if the review is still the exact pending version we moderated.

        If the author edited it meanwhile, updated_at changed and a newer webhook
        will moderate that version instead — so a stale result is dropped.
        """
        rows = (
            self.sb.table("reviews")
            .update({"status": status, "moderation_notes": notes or None})
            .eq("id", review_id)
            .eq("status", "pending")
            .eq("updated_at", updated_at)
            .execute()
            .data
        )
        return len(rows) > 0

    def count_approved(self, location_id: int) -> int:
        res = (
            self.sb.table("reviews")
            .select("id", count="exact", head=True)
            .eq("location_id", location_id)
            .eq("status", "approved")
            .execute()
        )
        return res.count or 0

    def summary_review_count(self, location_id: int) -> int | None:
        rows = self.sb.table("location_summaries").select("review_count").eq("location_id", location_id).execute().data
        return rows[0]["review_count"] if rows else None

    def recent_approved(self, location_id: int, limit: int) -> list[dict[str, Any]]:
        return (
            self.sb.table("reviews")
            .select("comment, attended_term, review_ratings(category, stars)")
            .eq("location_id", location_id)
            .eq("status", "approved")
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
            .data
        )

    def location_name(self, location_id: int) -> str:
        rows = self.sb.table("locations").select("name").eq("id", location_id).execute().data
        return rows[0]["name"] if rows else "this campus"

    def upsert_summary(self, location_id: int, summary: dict, review_count: int, model: str) -> None:
        self.sb.table("location_summaries").upsert(
            {
                "location_id": location_id,
                "summary": summary,
                "review_count": review_count,
                "model": model,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

    def user_id_from_jwt(self, jwt: str) -> str | None:
        try:
            res = self.sb.auth.get_user(jwt)
        except Exception:
            return None
        return res.user.id if res and res.user else None

    def is_admin(self, user_id: str) -> bool:
        rows = self.sb.table("profiles").select("is_admin").eq("id", user_id).execute().data
        return bool(rows and rows[0]["is_admin"])
