"""Admin CLI. Run from backend/:

    python -m app.cli summaries            # generate any stale summaries (e.g. before a demo)
    python -m app.cli summaries --force    # regenerate every campus with approved reviews
    python -m app.cli summaries --location 3
"""

import argparse
import logging
import sys

from .pipeline import regenerate_summary


def run_summaries(repo, llm, force: bool = False, location_id: int | None = None, out=print) -> int:
    locations = repo.list_locations()
    if location_id is not None:
        locations = [loc for loc in locations if loc["id"] == location_id]
        if not locations:
            out(f"No location with id {location_id}")
            return 1
    updated = 0
    for loc in locations:
        if regenerate_summary(loc["id"], repo, llm, force=force):
            updated += 1
            out(f"updated  {loc['name']}")
        else:
            out(f"skipped  {loc['name']}")
    out(f"{updated} of {len(locations)} summaries updated")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("summaries", help="generate campus summaries")
    p.add_argument("--force", action="store_true", help="regenerate even if not stale")
    p.add_argument("--location", type=int, help="only this location id")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.WARNING)
    from .main import get_llm, get_repo  # deferred: needs env vars

    return run_summaries(get_repo(), get_llm(), force=args.force, location_id=args.location)


if __name__ == "__main__":
    sys.exit(main())
