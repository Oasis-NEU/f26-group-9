# NUwhere

NUwhere is a website where Northeastern students rate and review NUin programs, Dialogues of Civilizations, and other Northeastern campus locations. Students who have been there share honest ratings on everything from food to dorms, so future students can choose where to go with real information.

Full technical spec: [`docs/proposal.md`](docs/proposal.md).

## Features

### Core
- **Guest browsing:** anyone can search and view locations, ratings, AI summaries, and reviews without an account.
- **Northeastern login:** writing a review requires signing in with a `@northeastern.edu` email via a one-time code.
- **Attendance list:** at onboarding, members list up to 3 campuses they attended (with starting term). You can only review campuses on your list.
- **5-star ratings by category** (any category can be N/A): Food, Surroundings, Social life, Education, Prices, Dorm, Campus.
- **Written comments and photos:** up to 4 photos per review, re-encoded in the browser to strip location metadata.
- **Default images:** each location has a cover image shown when there are no user photos.
- **Moderation:** every new or edited review is checked (profanity list + AI) before it's published. Flagged reviews go to an admin queue.
- **Rating averages:** per-category averages with review counts, an overall average, and a Bayesian-ranked score.
- **Search:** find campuses by name, city, country, or program.

### AI
- **Review summaries:** AI-generated pros/cons per category, based only on approved reviews.

### Planned (if time allows)
- **Location matching:** recommends locations from your category preferences.
- **Ask about this campus:** AI Q&A grounded in reviews.

## Tech stack
- **Frontend:** React + Vite (JavaScript), Tailwind, React Router
- **Database / auth / storage:** Supabase
- **Backend (moderation + AI only):** Python FastAPI in `backend/`
- **Linting:** Oxlint

## Repo layout
```
src/                 React app (pages, components, hooks, services, lib)
supabase/migrations  Ordered SQL migrations (schema, triggers, RLS, views, RPCs)
supabase/seed.sql    Campuses, programs, sample data
backend/             FastAPI moderation + AI summaries
docs/proposal.md     Technical spec
```

## Setup

### Frontend
```bash
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### Database
```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push          # applies supabase/migrations in order
```
Run `supabase/seed.sql` in the SQL editor (or `npx supabase db reset` locally).

One-time dashboard steps:
1. **Auth → Hooks:** enable the *Before User Created* hook and point it at `public.hook_nu_email_only`.
2. **Auth → Email Templates → Magic Link:** include `{{ .Token }}` so users get a 6-digit code.
3. **Make yourself admin:** `update profiles set is_admin = true where email = '<you>@northeastern.edu';`
4. **Database → Webhooks:** once the backend is deployed, add a webhook on `reviews` (INSERT + UPDATE) → `POST https://<backend>/webhooks/reviews` with header `X-Webhook-Secret`.

### Backend
See [`backend/README.md`](backend/README.md) for setup, tests, deployment, and webhook configuration.
