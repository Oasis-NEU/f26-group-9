# NUwhere backend

FastAPI service for review moderation and AI summaries (proposal §4.6–4.7, §6). It is the only place the Supabase **service role key** and the **Anthropic API key** live.

## How it works

```
reviews INSERT/UPDATE ──Supabase Database Webhook──▶ POST /webhooks/reviews  (202, work runs in background)
  status = pending   → profanity filter → Claude Haiku (text + photos) → approved | flagged
  pending/flagged → approved (auto or admin) → regenerate campus summary if stale
```

- **Moderation** uses `claude-haiku-5-5` with structured outputs (`{"decision", "reasons"}`), and review photos are sent as signed URLs so images get checked too.
- **Fail closed:** if Claude is unavailable, refuses, or returns a truncated response, the review is set to `flagged` with a note, so an admin decides.
- **Stale events are dropped:** a result only applies if the review is still the exact pending version that was checked (`id` + `status` + `updated_at`).
- **Summaries** are generated once a campus has ≥ 3 approved reviews, then regenerated after every 5 new ones. The newest 100 reviews are sent. Summaries are never generated on page load.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness check |
| POST | `/webhooks/reviews` | `X-Webhook-Secret` | Supabase webhook target |
| POST | `/admin/summaries/{location_id}` | `Authorization: Bearer <user JWT>` (admin) | Force-regenerate a summary |

## Run locally

```bash
cd backend
cp .env.example .env        # fill in values
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest
```

(No uv? `python -m venv .venv && .venv/bin/pip install -e . pytest httpx` works too.)

The hosted Supabase webhook can't reach `localhost`. For end-to-end testing, expose your dev server with `cloudflared tunnel --url http://localhost:8000` (or ngrok) and point the webhook at that URL.

## Pre-generate summaries

```bash
uv run python -m app.cli summaries            # only stale ones
uv run python -m app.cli summaries --force    # every campus with approved reviews
uv run python -m app.cli summaries --location 3
```

Admins can also regenerate one campus from **Moderation → Summaries** in the app (needs `VITE_BACKEND_URL` in the frontend `.env`).

## Deploy

Use any host that runs a long-lived process (Render, Railway, Fly.io). Avoid serverless functions: moderation runs as a background task after the webhook response is sent, and serverless platforms may kill it.

- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Env vars: everything in `.env.example`. Set `FRONTEND_ORIGINS` to the deployed site's origin.

Then in Supabase go to **Database → Webhooks → Create**:
- Table: `reviews`
- Events: Insert, Update
- Type: HTTP Request, `POST https://<backend>/webhooks/reviews`
- Header: `X-Webhook-Secret: <WEBHOOK_SECRET>`

## Layout

- `app/main.py`: routes and the webhook dispatch rules
- `app/pipeline.py`: moderation and summary logic
- `app/llm.py`: Claude calls, prompts, and response schemas
- `app/repo.py`: all Supabase access (service role)
- `app/cli.py`: admin CLI (summaries)
- `tests/`: pytest. The LLM tests run the real Anthropic SDK against a mock HTTP transport, so no API key or network is needed.
