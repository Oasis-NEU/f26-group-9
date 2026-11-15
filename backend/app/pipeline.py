"""Moderation + summary logic, independent of FastAPI and Supabase specifics."""

import logging

from better_profanity import profanity

from .config import MODEL, SUMMARY_MAX_REVIEWS, SUMMARY_MIN_REVIEWS, SUMMARY_REFRESH_DELTA
from .llm import LLM, LLMUnavailable

log = logging.getLogger(__name__)
profanity.load_censor_words()


def moderate_review(record: dict, repo, llm: LLM) -> str | None:
    """Decide approved/flagged for one pending review version. Returns the status set, or None if stale."""
    review_id = record["id"]
    comment = record["comment"]

    if profanity.contains_profanity(comment):
        status, notes = "flagged", "profanity filter"
    else:
        try:
            result = llm.moderate(comment, repo.photo_urls(review_id))
            status = "approved" if result.decision == "approve" else "flagged"
            notes = "; ".join(result.reasons)
        except LLMUnavailable as e:
            # Fail closed: a human looks at it in the flagged queue.
            log.warning("moderation unavailable for review %s: %s", review_id, e)
            status, notes = "flagged", f"automatic moderation unavailable: {e}"

    applied = repo.set_moderation_result(review_id, record["updated_at"], status, notes)
    if not applied:
        log.info("review %s changed since this event; result dropped", review_id)
        return None
    log.info("review %s -> %s", review_id, status)
    return status


def summary_is_stale(approved: int, last_count: int | None) -> bool:
    if last_count is None:
        return approved >= SUMMARY_MIN_REVIEWS
    return approved - last_count >= SUMMARY_REFRESH_DELTA


def regenerate_summary(location_id: int, repo, llm: LLM, force: bool = False) -> bool:
    """Regenerate the campus summary if stale (or forced). Returns True if a new summary was saved."""
    approved = repo.count_approved(location_id)
    if approved == 0:
        return False
    if not force and not summary_is_stale(approved, repo.summary_review_count(location_id)):
        return False

    reviews = repo.recent_approved(location_id, SUMMARY_MAX_REVIEWS)
    try:
        result = llm.summarize(repo.location_name(location_id), reviews)
    except LLMUnavailable as e:
        log.warning("summary failed for location %s: %s", location_id, e)
        return False

    # Store in the shape the frontend's AISummary expects: only categories with notes.
    categories = {k: v.model_dump() for k, v in result.categories if v and (v.pros or v.cons)}
    repo.upsert_summary(location_id, {"overview": result.overview, "categories": categories}, approved, MODEL)
    log.info("summary updated for location %s (%s reviews)", location_id, approved)
    return True
