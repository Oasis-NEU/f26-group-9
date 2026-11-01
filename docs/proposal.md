# Campus Ratings — Technical Plan

> Working title. A review platform where verified Northeastern students rate the campuses they attended, so admits and students choosing a location get honest, category-level information.

**Stack:** React (Vite) · Supabase (Postgres, Auth, Storage, Database Webhooks) · Python FastAPI backend (moderation + AI only)
**Target:** Oasis Demo Day, late November 2026

---

## 1. Decisions locked in

| Topic | Decision |
|---|---|
| Verification | Northeastern email only (`@northeastern.edu`), via email one-time code. No document scanning. |
| Campus attribution | Self-reported at onboarding as an **attendance list** (campus + starting term). |
| Attendance cap | Max **3 campuses** per user. A campus can't be removed once reviewed. |
| Review limit | **1 review per user per campus**. Editing replaces it; no second review. |
| Edit cooldown | **1 edit per hour** per review. Every edit goes back through moderation. |
| Guests | Read-only: browse, search, view scores, summaries, reviews, photos. |
| Reviewer identity | Reviews are shown as "Verified student · Attended Fall 2025". No names or emails displayed. |
| Ratings | 1–5 stars per category, any category can be N/A. At least one category required. |
| Overall score | Mean of the category averages (each category weighted equally). |
| Ranking | Bayesian average so low-review-count campuses don't dominate. |
| Enforcement | All rules live in Postgres (constraints, triggers, RLS), not just the UI. |

**Rating categories:** `food`, `surroundings` (renamed from "location"), `social`, `education`, `prices`, `dorm`, `campus`.

---

## 2. Architecture

```
┌──────────────┐   supabase-js (anon key + user JWT)   ┌──────────────────────────┐
│  React app   │ ────────────────────────────────────▶ │ Supabase                 │
│  (Vite)      │                                        │  • Auth (email OTP)      │
└──────────────┘                                        │  • Postgres + RLS        │
                                                        │  • Storage (photos)      │
                                                        └──────────┬───────────────┘
                                                                   │ Database Webhook
                                                                   │ (reviews insert/update)
                                                                   ▼
                                                        ┌──────────────────────────┐
                                                        │ FastAPI backend          │
                                                        │  • moderation pipeline   │
                                                        │  • AI summaries          │
                                                        │  • (stretch) AI Q&A      │
                                                        │  uses service role key   │
                                                        └──────────┬───────────────┘
                                                                   ▼
                                                             Claude API
```

The React app talks to Supabase directly for everything except moderation and AI. The backend is the only holder of the Supabase **service role key** and the Claude API key.

### Repo layout

```
/frontend            Vite + React + TypeScript
/backend             FastAPI (managed with uv)
/supabase
  /migrations        SQL from section 5, split into ordered files
  seed.sql           locations, programs, sample data
README.md
```

### Environment variables

| Where | Variable | Notes |
|---|---|---|
| frontend | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Safe to expose. |
| backend | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Never** in the frontend or git. |
| backend | `ANTHROPIC_API_KEY` | Never in the frontend. |
| backend | `WEBHOOK_SECRET` | Shared secret sent by the Supabase webhook as a header. |

---

## 3. User flows

### Guest
1. Lands on home → featured/top-ranked campuses + search bar.
2. Searches by campus name, city, or program → results list.
3. Opens a campus page → overall score, category bars (with counts), AI summary, approved reviews, photos.
4. Clicks **Write a review** → redirected to sign in.

### Member (first time)
1. Enters email → client rejects non-`@northeastern.edu` for UX; server hook enforces it.
2. Receives 6-digit code → verifies → session created, `profiles` row auto-created.
3. **Onboarding:** picks up to 3 attended campuses, each with a starting term (e.g. "Fall 2025").
4. Redirected back to the campus page they came from.

### Member (writing/editing a review)
1. **Write a review** appears only on campuses in their attendance list.
2. Form: stars per category (each with an N/A toggle), comment (20–3000 chars), up to 4 photos.
3. Submit → status `pending` → "Your review is being checked" banner (visible only to the author).
4. Moderation webhook → `approved` (published) or `flagged` (admin queue).
5. Editing later: same form pre-filled. Blocked if last edit < 1 hour ago. Edit resets status to `pending`.

### Admin
1. `/admin/moderation` lists `flagged` reviews with moderation reasons.
2. Approve or reject.

---

## 4. Features (MVP)

### 4.1 Auth — NU email only
- Supabase **email OTP**. Edit the Magic Link email template to include `{{ .Token }}` so users get a code instead of (or alongside) a link.
- Server-side domain gate with a **Before User Created** auth hook (section 5.2). Fallback if the hook isn't available on your plan: a `before insert` trigger on `auth.users` that raises an exception.
- `profiles` row created automatically on signup by trigger.

```ts
// request code
await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
// verify code
await supabase.auth.verifyOtp({ email, token, type: "email" });
```

### 4.2 Attendance list (campus attribution)
- Table `user_locations(user_id, location_id, first_term)`.
- Capped at 3 by trigger. Delete allowed only for campuses the user hasn't reviewed (RLS).
- The term is copied onto each review at insert, so the public can see "Attended Fall 2025" without being able to read anyone's attendance list.

### 4.3 Reviews and ratings
- Single RPC `submit_review(location_id, comment, ratings_json)` creates or updates the review and replaces its ratings in one transaction.
- `ratings_json` example: `{"food": 4, "dorm": 5, "prices": 2}` — omitted categories are N/A.
- Triggers force `status = 'pending'` on every user insert/edit, enforce the 1-hour edit cooldown, and stop users from changing `user_id`, `location_id`, or status.

### 4.4 Scores
- View `location_category_scores`: average + count per campus per category (approved reviews only).
- View `location_scores`: review count, overall average (mean of category averages), and Bayesian ranked score:

  `ranked = (C × m + n × overall) / (C + n)` where `m` = global mean rating, `n` = review count, `C = 5`.

- UI always shows the count next to an average ("4.3 · 12 reviews").

### 4.5 Photos
- Private Storage bucket `review-photos`, 5 MB limit, `image/jpeg`, `image/png`, `image/webp` only.
- Path format: `{user_id}/{review_id}/{uuid}.webp`.
- **Client-side re-encode before upload**: draw to a `<canvas>`, resize to max 1600px, export as WebP. This strips EXIF (including GPS coordinates of where students live).
- Max 4 photos per review (trigger).
- Photos are only readable when their review is approved (Storage RLS). Frontend fetches them with `createSignedUrls`.
- Each campus has a team-supplied `cover_image_url` shown when no user photos exist.

### 4.6 Moderation pipeline
Triggered by a Supabase **Database Webhook** on `reviews` INSERT and UPDATE → `POST /webhooks/reviews`.

1. Verify `X-Webhook-Secret` header.
2. Ignore events where `record.status != 'pending'` (prevents a loop when the backend itself updates status).
3. **Profanity check** with `better-profanity`. Hit → `flagged`.
4. **LLM moderation** (Claude): returns `{"decision": "approve" | "flag", "reasons": [...]}`. Flags harassment, personal info about named individuals, spam, off-topic content.
5. Update `status` + `moderation_notes` with the service role client.
6. If approved → check whether the campus summary is stale (4.7).

Plus a **Report** button on each review (stretch for week 4 if time is short) that flips it to `flagged`.

### 4.7 AI summaries
- Table `location_summaries(location_id, summary jsonb, review_count, model, updated_at)`.
- Regenerate when: no summary exists and the campus has ≥ 3 approved reviews, **or** approved count − `review_count` at last generation ≥ 5.
- Never generated on page load.
- Input: up to 100 most recent approved reviews (comment + category ratings).
- Output JSON:

```json
{
  "overview": "2–3 sentence summary",
  "categories": {
    "food": { "pros": ["..."], "cons": ["..."] },
    "dorm": { "pros": ["..."], "cons": ["..."] }
  }
}
```

- Prompt rules: only use what's in the reviews, don't invent facts, mention when reviewers disagree, skip categories with no comments.
- UI label: "AI summary · based on N reviews".

### 4.8 Search
- `tsvector` generated columns on `locations` and `programs`.
- RPC `search_locations(q)` matches campus name/city/country/description, programs offered there, plus an `ilike` fallback for partial words.
- Category filters ("social ≥ 4") applied client-side against `location_category_scores`.

### 4.9 Rate limits summary

| Action | Limit | Enforced by |
|---|---|---|
| Campuses in attendance list | 3 | Trigger |
| Reviews per campus per user | 1 | Unique constraint |
| Review edits | 1 per hour | Trigger |
| Photos per review | 4 | Trigger |
| Photo size | 5 MB | Bucket config |
| (Stretch) Replies | 20/day per user | Trigger or backend |
| (Stretch) AI Q&A | Guests 5/day per IP, members 20/day | Backend |

---

## 5. Database

> Apply in order as migrations. Verify auth hook syntax against current Supabase docs before running.

### 5.1 Types and tables

```sql
create type rating_category as enum
  ('food', 'surroundings', 'social', 'education', 'prices', 'dorm', 'campus');

create type review_status as enum ('pending', 'approved', 'flagged', 'rejected');

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

create table locations (
  id              bigint generated always as identity primary key,
  slug            text unique not null,
  name            text not null,
  city            text not null,
  country         text not null,
  description     text,
  cover_image_url text,
  search          tsvector generated always as (
    to_tsvector('english',
      coalesce(name, '') || ' ' || coalesce(city, '') || ' ' ||
      coalesce(country, '') || ' ' || coalesce(description, ''))
  ) stored
);
create index locations_search_idx on locations using gin (search);

create table programs (
  id          bigint generated always as identity primary key,
  slug        text unique not null,
  name        text not null,
  description text,
  search      tsvector generated always as (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored
);
create index programs_search_idx on programs using gin (search);

create table program_locations (
  program_id  bigint references programs(id) on delete cascade,
  location_id bigint references locations(id) on delete cascade,
  primary key (program_id, location_id)
);

create table user_locations (
  user_id     uuid references profiles(id) on delete cascade,
  location_id bigint references locations(id) on delete cascade,
  first_term  text not null,                 -- e.g. 'Fall 2025'
  created_at  timestamptz not null default now(),
  primary key (user_id, location_id)
);

create table reviews (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references profiles(id) on delete cascade,
  location_id      bigint not null references locations(id) on delete cascade,
  attended_term    text not null,            -- copied from user_locations
  comment          text not null check (char_length(comment) between 20 and 3000),
  status           review_status not null default 'pending',
  moderation_notes text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint one_review_per_location unique (user_id, location_id)
);
create index reviews_location_status_idx on reviews (location_id, status);

create table review_ratings (
  review_id bigint references reviews(id) on delete cascade,
  category  rating_category not null,
  stars     smallint not null check (stars between 1 and 5),
  primary key (review_id, category)          -- N/A = no row
);

create table review_photos (
  id           bigint generated always as identity primary key,
  review_id    bigint not null references reviews(id) on delete cascade,
  storage_path text not null unique,
  created_at   timestamptz not null default now()
);

create table location_summaries (
  location_id  bigint primary key references locations(id) on delete cascade,
  summary      jsonb not null,
  review_count int not null,
  model        text not null,
  updated_at   timestamptz not null default now()
);
```

### 5.2 Auth: domain gate + profile creation

```sql
-- Before User Created hook: reject non-NU emails.
-- Enable in Dashboard → Authentication → Hooks after creating it.
create or replace function public.hook_nu_email_only(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  user_email text := lower(event -> 'user' ->> 'email');
begin
  if user_email is null or user_email not like '%@northeastern.edu' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Please sign in with your @northeastern.edu email.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_nu_email_only to supabase_auth_admin;
revoke execute on function public.hook_nu_email_only from authenticated, anon, public;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin check used by policies
create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
```

### 5.3 Triggers (limits and integrity)

> `current_user = 'authenticated'` means the change came from a signed-in user through the API. The backend (service role) and security-definer functions skip the user rules.

```sql
-- Attendance list capped at 3
create or replace function public.enforce_location_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.user_locations where user_id = new.user_id) >= 3 then
    raise exception 'You can list at most 3 campuses';
  end if;
  return new;
end;
$$;

create trigger location_cap
  before insert on user_locations
  for each row execute function public.enforce_location_cap();

-- Review insert: force pending, copy attended term
create or replace function public.reviews_before_insert()
returns trigger language plpgsql as $$
declare
  v_term text;
begin
  if current_user = 'authenticated' then
    new.user_id := auth.uid();
    new.status := 'pending';
    new.moderation_notes := null;
  end if;

  select first_term into v_term
  from public.user_locations
  where user_id = new.user_id and location_id = new.location_id;

  if v_term is null then
    raise exception 'You can only review campuses in your attendance list';
  end if;

  new.attended_term := v_term;
  return new;
end;
$$;

create trigger reviews_insert
  before insert on reviews
  for each row execute function public.reviews_before_insert();

-- Review update: cooldown, lock identity fields, re-moderate
create or replace function public.reviews_before_update()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if old.updated_at > now() - interval '1 hour' then
      raise exception 'You can edit a review once per hour';
    end if;
    new.user_id := old.user_id;
    new.location_id := old.location_id;
    new.attended_term := old.attended_term;
    new.status := 'pending';
    new.moderation_notes := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger reviews_update
  before update on reviews
  for each row execute function public.reviews_before_update();

-- Max 4 photos per review
create or replace function public.enforce_photo_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.review_photos where review_id = new.review_id) >= 4 then
    raise exception 'A review can have at most 4 photos';
  end if;
  return new;
end;
$$;

create trigger photo_cap
  before insert on review_photos
  for each row execute function public.enforce_photo_cap();
```

### 5.4 Row Level Security

```sql
alter table profiles           enable row level security;
alter table locations          enable row level security;
alter table programs           enable row level security;
alter table program_locations  enable row level security;
alter table user_locations     enable row level security;
alter table reviews            enable row level security;
alter table review_ratings     enable row level security;
alter table review_photos      enable row level security;
alter table location_summaries enable row level security;

-- Profiles: own row only
create policy "read own profile" on profiles
  for select to authenticated using (id = auth.uid());

-- Public reference data (writes via service role / seed only)
create policy "public read" on locations          for select to anon, authenticated using (true);
create policy "public read" on programs           for select to anon, authenticated using (true);
create policy "public read" on program_locations  for select to anon, authenticated using (true);
create policy "public read" on location_summaries for select to anon, authenticated using (true);

-- Attendance list: private to owner
create policy "read own attendance" on user_locations
  for select to authenticated using (user_id = auth.uid());

create policy "add own attendance" on user_locations
  for insert to authenticated with check (user_id = auth.uid());

create policy "delete unreviewed attendance" on user_locations
  for delete to authenticated
  using (
    user_id = auth.uid()
    and not exists (
      select 1 from reviews r
      where r.user_id = auth.uid() and r.location_id = user_locations.location_id
    )
  );

-- Reviews
create policy "read approved, own, or admin" on reviews
  for select to anon, authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());

create policy "insert own for attended campus" on reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from user_locations ul
      where ul.user_id = auth.uid() and ul.location_id = reviews.location_id
    )
  );

create policy "update own" on reviews
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "delete own" on reviews
  for delete to authenticated using (user_id = auth.uid());

-- Ratings follow their review
create policy "read ratings of visible reviews" on review_ratings
  for select to anon, authenticated
  using (exists (
    select 1 from reviews r
    where r.id = review_ratings.review_id
      and (r.status = 'approved' or r.user_id = auth.uid() or public.is_admin())
  ));

create policy "write ratings on own review" on review_ratings
  for all to authenticated
  using (exists (select 1 from reviews r where r.id = review_ratings.review_id and r.user_id = auth.uid()))
  with check (exists (select 1 from reviews r where r.id = review_ratings.review_id and r.user_id = auth.uid()));

-- Photos follow their review
create policy "read photos of visible reviews" on review_photos
  for select to anon, authenticated
  using (exists (
    select 1 from reviews r
    where r.id = review_photos.review_id
      and (r.status = 'approved' or r.user_id = auth.uid() or public.is_admin())
  ));

create policy "add photos to own review" on review_photos
  for insert to authenticated
  with check (exists (select 1 from reviews r where r.id = review_photos.review_id and r.user_id = auth.uid()));

create policy "delete photos from own review" on review_photos
  for delete to authenticated
  using (exists (select 1 from reviews r where r.id = review_photos.review_id and r.user_id = auth.uid()));
```

### 5.5 Storage policies

Create bucket `review-photos` (private, 5 MB limit, allowed types `image/jpeg, image/png, image/webp`).

```sql
create policy "upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "read photos of approved or own reviews" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'review-photos'
    and exists (
      select 1 from public.review_photos p
      join public.reviews r on r.id = p.review_id
      where p.storage_path = storage.objects.name
        and (r.status = 'approved' or r.user_id = auth.uid())
    )
  );

create policy "delete own photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

### 5.6 Views

```sql
create view location_category_scores with (security_invoker = true) as
select
  r.location_id,
  rr.category,
  round(avg(rr.stars)::numeric, 2) as avg_stars,
  count(*)                          as rating_count
from reviews r
join review_ratings rr on rr.review_id = r.id
where r.status = 'approved'
group by r.location_id, rr.category;

create view location_scores with (security_invoker = true) as
with global as (
  select coalesce(avg(rr.stars), 3)::numeric as m
  from review_ratings rr
  join reviews r on r.id = rr.review_id
  where r.status = 'approved'
),
per_location as (
  select
    l.id as location_id,
    l.slug,
    l.name,
    (select count(*) from reviews r
      where r.location_id = l.id and r.status = 'approved') as review_count,
    (select round(avg(s.avg_stars), 2) from location_category_scores s
      where s.location_id = l.id) as overall_avg
  from locations l
)
select
  p.*,
  round(
    (5 * g.m + p.review_count * coalesce(p.overall_avg, g.m)) / (5 + p.review_count),
    2
  ) as ranked_score
from per_location p cross join global g;
```

### 5.7 RPCs

```sql
-- Create or edit a review + its ratings atomically.
-- p_ratings: {"food": 4, "dorm": 5}; omitted categories = N/A.
create or replace function public.submit_review(
  p_location_id bigint,
  p_comment     text,
  p_ratings     jsonb
) returns bigint
language plpgsql
as $$
declare
  v_review_id bigint;
begin
  if p_ratings is null or jsonb_typeof(p_ratings) <> 'object'
     or (select count(*) from jsonb_object_keys(p_ratings)) = 0 then
    raise exception 'Rate at least one category';
  end if;

  insert into public.reviews (user_id, location_id, comment, attended_term)
  values (auth.uid(), p_location_id, p_comment, '')   -- term set by trigger
  on conflict (user_id, location_id)
    do update set comment = excluded.comment
  returning id into v_review_id;

  delete from public.review_ratings where review_id = v_review_id;

  insert into public.review_ratings (review_id, category, stars)
  select v_review_id, key::public.rating_category, value::smallint
  from jsonb_each_text(p_ratings);

  return v_review_id;
end;
$$;

-- Search campuses by name/city/country/description or by program
create or replace function public.search_locations(q text)
returns setof public.locations
language sql stable
as $$
  select l.*
  from public.locations l
  where l.id in (
    select l2.id from public.locations l2
    where l2.search @@ websearch_to_tsquery('english', q)
       or l2.name ilike '%' || q || '%'
       or l2.city ilike '%' || q || '%'
    union
    select pl.location_id
    from public.program_locations pl
    join public.programs p on p.id = pl.program_id
    where p.search @@ websearch_to_tsquery('english', q)
       or p.name ilike '%' || q || '%'
  );
$$;

-- Admin moderation decision (runs as owner, so user-edit trigger rules are skipped)
create or replace function public.moderate_review(p_review_id bigint, p_decision public.review_status)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  update public.reviews set status = p_decision where id = p_review_id;
end;
$$;
```

### 5.8 Seed data

```sql
-- Fill from Northeastern's official campus list.
insert into locations (slug, name, city, country, description) values
  ('boston', 'Boston', 'Boston', 'United States', '...'),
  ('london', 'London', 'London', 'United Kingdom', '...');
  -- add remaining campuses

-- Programs and which campuses offer them
-- insert into programs (...) values (...);
-- insert into program_locations (...) values (...);
```

---

## 6. Backend (FastAPI)

### Setup

```bash
cd backend
uv init
uv add fastapi uvicorn supabase anthropic better-profanity python-dotenv
uv run uvicorn main:app --reload
```

### Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/webhooks/reviews` | `X-Webhook-Secret` | Moderation pipeline (4.6) |
| POST | `/admin/summaries/{location_id}` | Admin JWT | Force-regenerate a summary |
| POST | `/ask` (stretch) | Optional JWT | AI Q&A about a campus, rate-limited |

Configure the Supabase Database Webhook: table `reviews`, events INSERT + UPDATE, HTTP POST to `https://<backend>/webhooks/reviews`, header `X-Webhook-Secret: <WEBHOOK_SECRET>`.

### Moderation sketch

```python
import json
import os

from anthropic import Anthropic
from better_profanity import profanity
from fastapi import FastAPI, Header, HTTPException
from supabase import create_client

app = FastAPI()
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
claude = Anthropic()
MODEL = "claude-haiku-5-5"  # small, fast model; see docs.claude.com for current models
profanity.load_censor_words()

MOD_SYSTEM = """You moderate student reviews of university campuses.
Flag a review if it contains: harassment or slurs, personal information about
a named individual, spam/advertising, or content unrelated to the campus.
Harsh but honest criticism is allowed.
Respond with JSON only: {"decision": "approve" | "flag", "reasons": [string]}"""


def llm_moderate(comment: str) -> dict:
    resp = claude.messages.create(
        model=MODEL,
        max_tokens=300,
        system=MOD_SYSTEM,
        messages=[{"role": "user", "content": comment}],
    )
    text = resp.content[0].text.strip().removeprefix("```json").removesuffix("```")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"decision": "flag", "reasons": ["moderation output unparseable"]}


@app.post("/webhooks/reviews")
def review_webhook(payload: dict, x_webhook_secret: str = Header(...)):
    if x_webhook_secret != os.environ["WEBHOOK_SECRET"]:
        raise HTTPException(401)

    record = payload.get("record") or {}
    if record.get("status") != "pending":
        return {"skipped": True}  # avoids loop on our own status update

    comment = record["comment"]
    if profanity.contains_profanity(comment):
        status, notes = "flagged", "profanity"
    else:
        result = llm_moderate(comment)
        status = "approved" if result.get("decision") == "approve" else "flagged"
        notes = "; ".join(result.get("reasons", []))

    sb.table("reviews").update(
        {"status": status, "moderation_notes": notes}
    ).eq("id", record["id"]).execute()

    if status == "approved":
        maybe_regenerate_summary(record["location_id"])
    return {"status": status}
```

### Summary regeneration sketch

```python
SUMMARY_SYSTEM = """Summarize student reviews of one university campus.
Use only information in the reviews. Do not invent facts.
Note where reviewers disagree. Skip categories nobody commented on.
Respond with JSON only:
{"overview": string,
 "categories": {"<category>": {"pros": [string], "cons": [string]}}}"""


def maybe_regenerate_summary(location_id: int) -> None:
    approved = (
        sb.table("reviews")
        .select("id, comment, review_ratings(category, stars)")
        .eq("location_id", location_id)
        .eq("status", "approved")
        .order("updated_at", desc=True)
        .limit(100)
        .execute()
        .data
    )
    n = len(approved)
    existing = (
        sb.table("location_summaries").select("review_count")
        .eq("location_id", location_id).execute().data
    )
    last_n = existing[0]["review_count"] if existing else 0

    should = (not existing and n >= 3) or (existing and n - last_n >= 5)
    if not should:
        return

    body = "\n\n".join(
        f"Review {i+1} ratings={ {r['category']: r['stars'] for r in rev['review_ratings']} }\n{rev['comment']}"
        for i, rev in enumerate(approved)
    )
    resp = claude.messages.create(
        model=MODEL, max_tokens=1200, system=SUMMARY_SYSTEM,
        messages=[{"role": "user", "content": body}],
    )
    text = resp.content[0].text.strip().removeprefix("```json").removesuffix("```")
    summary = json.loads(text)

    sb.table("location_summaries").upsert({
        "location_id": location_id,
        "summary": summary,
        "review_count": n,
        "model": MODEL,
    }).execute()
```

> Note: the count above caps at 100 because of `.limit(100)`. If a campus might exceed 100 reviews, fetch the count separately with `select("id", count="exact")`.

---

## 7. Frontend (React)

### Routes

| Route | Access | Contents |
|---|---|---|
| `/` | Public | Search bar, top-ranked campuses (`ranked_score`) |
| `/search?q=` | Public | `search_locations` results + category filters |
| `/campus/:slug` | Public | Scores, category bars, AI summary, reviews, photos, Write/Edit review button |
| `/login` | Public | Email → code entry |
| `/onboarding` | Member | Pick up to 3 campuses + starting term |
| `/campus/:slug/review` | Member, attended | Review form (create/edit) |
| `/me` | Member | Attendance list, my reviews + their status |
| `/admin/moderation` | Admin | Flagged queue, approve/reject via `moderate_review` |

### Key components
- `AuthGate` — redirects to `/login` (and to `/onboarding` if attendance list is empty).
- `CategoryBars` — horizontal bars per category with average + count; hidden if no ratings.
- `StarInput` — 1–5 stars with N/A toggle.
- `PhotoUploader` — canvas resize/re-encode → upload → insert `review_photos` row; max 4.
- `ReviewCard` — "Verified student · Attended {term}", ratings, comment, photos.
- `AISummary` — renders `summary` JSON with "based on N reviews".
- `StatusBanner` — shows pending/flagged state on the author's own review.

### Photo re-encode helper

```ts
export async function toCleanWebp(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("encode failed"))), "image/webp", 0.85)
  );
}
```

### Submit flow

```ts
// 1. Review + ratings
const { data: reviewId, error } = await supabase.rpc("submit_review", {
  p_location_id: locationId,
  p_comment: comment,
  p_ratings: ratings, // { food: 4, dorm: 5 }
});

// 2. Photos
for (const file of files) {
  const blob = await toCleanWebp(file);
  const path = `${userId}/${reviewId}/${crypto.randomUUID()}.webp`;
  await supabase.storage.from("review-photos").upload(path, blob, { contentType: "image/webp" });
  await supabase.from("review_photos").insert({ review_id: reviewId, storage_path: path });
}
```

Surface trigger errors (cooldown, caps) directly to the user — the messages are written to be user-facing.

---

## 8. Stretch features

### Matching
User sets a weight 0–5 per category. For each campus:

`match = Σ (weight_c × avg_c) / Σ weight_c` over categories that campus has ratings for.

Compute client-side from `location_category_scores`. No ML required. Show top 3 with "why": the highest-weighted categories where the campus scores well.

### AI Q&A ("Ask about this campus")
- `POST /ask { location_id, question }` → answer grounded only in that campus's approved reviews + summary.
- Rate limit table `ai_queries(id, user_id uuid null, ip_hash text null, created_at)`; backend counts the last 24 hours: guests 5/day per hashed IP, members 20/day.

### Replies on reviews
- `review_replies` table, same moderation webhook, 20/day per user via trigger.

### Report button
- Sets a review to `flagged` with a reason; admins see it in the queue.

---

## 9. Security checklist

- [ ] RLS enabled on **every** public table (Supabase dashboard warns if not).
- [ ] Service role key only in backend env, never committed.
- [ ] Webhook secret checked on every request.
- [ ] Domain gate enforced server-side (hook or trigger), not only in the form.
- [ ] Photos re-encoded client-side (EXIF stripped); bucket size/type limits set.
- [ ] Reviews show no names or emails.
- [ ] Backend CORS restricted to the frontend origin.
- [ ] Test RLS as anon, as a normal user, and as a second user trying to edit the first user's review.

---

## 10. Timeline (to late-November Demo Day)

| Week | Focus | Done when |
|---|---|---|
| **Nov 2–8** | Schema, triggers, RLS, auth hook, seed campuses, read-only campus pages | A guest can browse campuses; a non-NU email is rejected |
| **Nov 9–15** | Onboarding, `submit_review`, review form, score views, photos | A member can review an attended campus and see averages update (manually approved) |
| **Nov 16–22** | Backend: moderation webhook, AI summaries; search; admin queue | Reviews auto-moderate; summaries appear after 3 reviews |
| **Nov 23–Demo** | Matching (stretch), polish, collect 20–30 real reviews, demo script | Live demo runs end-to-end on real data |

Thanksgiving is Nov 26 — plan for reduced availability that week and treat it as buffer.

### Suggested split (adjust to team size)
- **Database & auth:** sections 5.1–5.7, auth hook, RLS tests.
- **Frontend:** routes, components, photo upload.
- **Backend & AI:** FastAPI, webhook, moderation, summaries, matching.

---

## 11. Demo prep

- Collect 20–30 real reviews across several campuses before Demo Day so scores and summaries have substance.
- Pre-generate summaries so the demo doesn't wait on API calls.
- Demo script: guest search → campus page with summary → sign in with NU email → write review → show it pending → approve → score updates.
- Have a backup screen recording.

---

## 12. Open items

- [ ] Confirm students at **every** campus get `@northeastern.edu` addresses; if not, add the extra domains to the auth hook.
- [ ] Confirm the exact Demo Day date.
- [ ] Final campus list and program-to-campus mapping for the seed file.
- [ ] Final app name.
- [ ] Where to host the backend.
