# Demo Day runbook

The live flow from proposal §11, plus everything to check beforehand. Work through the checklist the week before, not the morning of.

## 1. Setup (once)

- [ ] **Database:** `npx supabase db push` (includes the reports migration `20261116000001`).
- [ ] **Auth:** *Before User Created* hook enabled, and the Magic Link template includes `{{ .Token }}`.
- [ ] **Admin:** `update profiles set is_admin = true where email = '<you>@northeastern.edu';`
- [ ] **Backend:** deployed with the env vars from `backend/.env.example`; `GET /health` returns `{"ok":true}`.
- [ ] **Webhook:** Supabase webhook on `reviews` (INSERT + UPDATE) → `https://<backend>/webhooks/reviews` with `X-Webhook-Secret`.
- [ ] **Frontend:** deployed with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_BACKEND_URL`.
- [ ] **SPA fallback:** configured on the host. Refreshing `/campus/boston` must not 404.
- [ ] **Backend CORS:** `FRONTEND_ORIGINS` includes the deployed site's origin.

## 2. Real data (week of Nov 23)

- [ ] **Remove seed reviews:** `delete from auth.users where email like 'seed-%@example.com';` (this cascades to their reviews).
- [ ] **Cover images:** fill in `cover_image_url` for campuses that will appear in the demo.
- [ ] **Collect reviews:** 20–30 real reviews across several campuses, with at least **3 on each campus you'll show**, so it has a summary. Send classmates the site link; the sign-in flow is the onboarding.
- [ ] **Clear the queue:** check Moderation → Flagged and approve or reject everything there.
- [ ] **Pre-generate summaries:** `python -m app.cli summaries --force` in `backend/`, or use Moderation → Summaries. Check that each demo campus shows "AI summary · based on N reviews".

## 3. Security checklist (proposal §9)

- [ ] **RLS:** enabled on every table. The Supabase dashboard → Advisors shows no "RLS disabled" warnings.
- [ ] **Secrets:** the service role and Anthropic keys exist only in the backend host's env. Running `git grep -n "service_role\|sk-ant"` finds only docs and placeholders.
- [ ] **Webhook secret:** `curl -X POST https://<backend>/webhooks/reviews -d '{}' -H 'Content-Type: application/json'` returns 401.
- [ ] **Domain gate:** signing in with a gmail address fails at the server, not just the form. Test it with the browser's form validation bypassed, or with `supabase.auth.signInWithOtp` from the console.
- [ ] **Photo EXIF:** upload a phone photo, download the stored file from Storage, and confirm `exiftool` shows no GPS.
- [ ] **No identity on reviews:** reviews show no names or emails.
- [ ] **Two-account RLS check:** account B can't see A's pending review, and can't edit it (try `supabase.from('reviews').update(...)` in the console as B).

## 4. Live script (~4 minutes)

1. **Guest browse.** Open the home page signed out. Point out top-rated campuses ranked by Bayesian score, with review counts.
2. **Search.** Type "London" (or a program name). Apply a "Social 4+" filter.
3. **Campus page.** Walk through the overall score, category bars with counts, the **AI summary**, and reviews ("Verified student · Attended Fall 2025", no names).
4. **Find a match.** Slide Food and Prices up and Social down, and show how the top 3 change, with the "Strong on…" reasons.
5. **Sign in.** Click *Write a review* and enter your NU email. Optionally show a gmail address being rejected. Enter the code from your email.
6. **Onboarding.** The campus you came from is preselected. Pick the term and continue.
7. **Write a review.** Add stars (mark one N/A), a comment and a photo, then submit. The "Your review is being checked" banner appears.
8. **Auto-moderation.** Refresh after a few seconds: it's approved, and the category averages updated.
9. **Moderation fallback.** Briefly show the admin queue (flagged reviews with AI reasons) and the Report button on someone else's review.

**Have open in tabs beforehand:** your email inbox (for the code), the campus page, and the admin queue.

## 5. If something breaks

| Problem | Fallback |
|---|---|
| Code email is slow | Sign in before the demo in a second browser profile and switch to it |
| Backend or Claude down | The review stays pending or gets flagged. Approve it by hand in **Moderation → Pending**; scores still update |
| Summary missing | Moderation → Summaries → Regenerate, or show a campus that already has one |
| Wi-Fi fails | Play the backup screen recording (record it the day before) |

## Not built (stretch)

- AI Q&A ("Ask about this campus"), proposal §8
- Replies on reviews
