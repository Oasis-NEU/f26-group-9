from app.cli import run_summaries
from tests.fakes import FakeRepo
from tests.test_pipeline import StubLLM, _summary


def test_generates_stale_summaries_for_all_locations():
    repo, lines = FakeRepo(approved=3), []
    assert run_summaries(repo, StubLLM(summary=_summary()), out=lines.append) == 0
    assert [s[0] for s in repo.summaries] == [1, 2]
    assert lines[-1] == "2 of 2 summaries updated"


def test_skips_fresh_summaries_unless_forced():
    repo, lines = FakeRepo(approved=4, last_summary_count=3), []
    run_summaries(repo, StubLLM(summary=_summary()), out=lines.append)
    assert repo.summaries == []
    run_summaries(repo, StubLLM(summary=_summary()), force=True, out=lines.append)
    assert len(repo.summaries) == 2


def test_single_location_and_unknown_id():
    repo, lines = FakeRepo(approved=3), []
    assert run_summaries(repo, StubLLM(summary=_summary()), location_id=2, out=lines.append) == 0
    assert [s[0] for s in repo.summaries] == [2]
    assert run_summaries(repo, StubLLM(summary=_summary()), location_id=99, out=lines.append) == 1
