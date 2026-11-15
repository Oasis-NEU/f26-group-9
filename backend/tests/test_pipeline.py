from app.llm import CategoryNotes, LLMUnavailable, ModerationResult, SummaryCategories, SummaryResult
from app.pipeline import moderate_review, regenerate_summary, summary_is_stale
from tests.fakes import FakeRepo

RECORD = {"id": 7, "location_id": 1, "comment": "The dorms were cramped but the city is amazing.", "updated_at": "2026-11-15T10:00:00.123456+00:00"}


class StubLLM:
    def __init__(self, moderation=None, summary=None, error=None):
        self.moderation, self.summary, self.error = moderation, summary, error
        self.calls = []

    def moderate(self, comment, image_urls):
        self.calls.append(("moderate", comment, image_urls))
        if self.error:
            raise self.error
        return self.moderation

    def summarize(self, name, reviews):
        self.calls.append(("summarize", name, len(reviews)))
        if self.error:
            raise self.error
        return self.summary


def test_profanity_flags_without_calling_llm():
    repo, llm = FakeRepo(), StubLLM()
    status = moderate_review({**RECORD, "comment": "This place is shit and full of assholes."}, repo, llm)
    assert status == "flagged"
    assert llm.calls == []
    assert repo.moderation_calls[0][3] == "profanity filter"


def test_llm_approve_passes_photos_and_version():
    repo = FakeRepo(photos=["https://signed/1"])
    llm = StubLLM(moderation=ModerationResult(decision="approve", reasons=[]))
    assert moderate_review(RECORD, repo, llm) == "approved"
    assert llm.calls[0][2] == ["https://signed/1"]
    assert repo.moderation_calls == [(7, RECORD["updated_at"], "approved", "")]


def test_llm_flag_records_reasons():
    repo = FakeRepo()
    llm = StubLLM(moderation=ModerationResult(decision="flag", reasons=["personal info", "spam"]))
    assert moderate_review(RECORD, repo, llm) == "flagged"
    assert repo.moderation_calls[0][3] == "personal info; spam"


def test_llm_unavailable_fails_closed():
    repo = FakeRepo()
    assert moderate_review(RECORD, repo, StubLLM(error=LLMUnavailable("rate limited"))) == "flagged"
    assert "unavailable" in repo.moderation_calls[0][3]


def test_stale_version_is_dropped():
    repo = FakeRepo()
    repo.apply_moderation = False
    assert moderate_review(RECORD, repo, StubLLM(moderation=ModerationResult(decision="approve", reasons=[]))) is None


def test_summary_staleness_rules():
    assert not summary_is_stale(2, None)
    assert summary_is_stale(3, None)
    assert not summary_is_stale(7, 3)
    assert summary_is_stale(8, 3)


def _summary():
    cats = {k: None for k in SummaryCategories.model_fields}
    cats["food"] = CategoryNotes(pros=["good"], cons=["pricey"])
    cats["dorm"] = CategoryNotes(pros=[], cons=[])  # empty -> dropped
    return SummaryResult(overview="Solid.", categories=SummaryCategories(**cats))


def test_summary_generated_when_threshold_met():
    repo = FakeRepo(approved=3)
    assert regenerate_summary(1, repo, StubLLM(summary=_summary()))
    loc, summary, count, model = repo.summaries[0]
    assert (loc, count, model) == (1, 3, "claude-haiku-5-5")
    assert summary == {"overview": "Solid.", "categories": {"food": {"pros": ["good"], "cons": ["pricey"]}}}


def test_summary_skipped_below_threshold_unless_forced():
    repo, llm = FakeRepo(approved=2), StubLLM(summary=_summary())
    assert not regenerate_summary(1, repo, llm)
    assert llm.calls == []
    assert regenerate_summary(1, repo, llm, force=True)


def test_summary_never_generated_without_reviews():
    assert not regenerate_summary(1, FakeRepo(approved=0), StubLLM(summary=_summary()), force=True)


def test_summary_failure_keeps_old_summary():
    repo = FakeRepo(approved=3)
    assert not regenerate_summary(1, repo, StubLLM(error=LLMUnavailable("down")))
    assert repo.summaries == []
