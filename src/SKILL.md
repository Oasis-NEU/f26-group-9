---
name: oasis-conventions
description: Coding conventions for NUwhere, the Oasis NUin/Dialogue/campus rating site. Use whenever writing, reviewing, or changing code in this repo.
---

# NUwhere project conventions

## Project overview
Website where verified Northeastern students rate the campuses / NUin / Dialogue locations they attended so future students can choose. Full spec: `docs/proposal.md`.

## Tech stack
- Frontend: React + Vite, **JavaScript** (no TypeScript), Tailwind v4, React Router
- Database / auth / storage: Supabase (Postgres + RLS, email OTP, Storage)
- Backend: Python FastAPI (`backend/`, managed with `uv`) — moderation and AI only
- AI: Claude API, called only from the backend

## Code style
- Naming: camelCase for variables/functions, PascalCase for components; snake_case in SQL and Python
- Linting: `npm run lint` (oxlint) must pass
- Comments: explain why, not what

## Folder structure
- `src/pages` — one component per route
- `src/components` — reusable UI
- `src/hooks` — React hooks (`useSession`, etc.)
- `src/services` — all Supabase calls live here; pages don't call `supabase` directly
- `src/lib` — `supabase.js` (the single shared client), constants, helpers
- `supabase/migrations` — ordered SQL, never edit an applied migration; add a new one
- `backend/` — FastAPI

## Security rules
- Business rules (caps, cooldowns, one review per campus) are enforced in Postgres (triggers/RLS). UI checks are UX only.
- The service role key and Anthropic key live only in `backend/.env`. Never in the frontend or git.
- Reviews never display names or emails — only "Verified student · Attended {term}".

## Git workflow
- Branch names: feature/<short-name>, fix/<short-name>
- Commit messages: imperative, e.g. "Add rating endpoint for locations"
- Open a PR and get one teammate review before merging to main

## Data rules
- Ratings are 1 to 5 stars per category, tied to a **location**; N/A = no row. Categories: food, surroundings, social, education, prices, dorm, campus
- Never store anything identifying beyond what the user chooses to show

## Testing
- Frontend: `npm run lint && npm run build`, then walk the demo script in `docs/proposal.md` §11
- Database: RLS checks via `set role` in the SQL editor (see `docs/proposal.md` §9)
