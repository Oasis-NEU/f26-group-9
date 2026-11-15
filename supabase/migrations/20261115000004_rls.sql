-- Row Level Security (docs/proposal.md §5.4)

alter table public.profiles           enable row level security;
alter table public.locations          enable row level security;
alter table public.programs           enable row level security;
alter table public.program_locations  enable row level security;
alter table public.user_locations     enable row level security;
alter table public.reviews            enable row level security;
alter table public.review_ratings     enable row level security;
alter table public.review_photos      enable row level security;
alter table public.location_summaries enable row level security;

-- Profiles: own row only (no update policy, so users can't set is_admin)
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

-- Public reference data (writes via service role / seed only)
create policy "public read" on public.locations          for select to anon, authenticated using (true);
create policy "public read" on public.programs           for select to anon, authenticated using (true);
create policy "public read" on public.program_locations  for select to anon, authenticated using (true);
create policy "public read" on public.location_summaries for select to anon, authenticated using (true);

-- Attendance list: private to owner
create policy "read own attendance" on public.user_locations
  for select to authenticated using (user_id = auth.uid());

create policy "add own attendance" on public.user_locations
  for insert to authenticated with check (user_id = auth.uid());

create policy "delete unreviewed attendance" on public.user_locations
  for delete to authenticated
  using (
    user_id = auth.uid()
    and not exists (
      select 1 from public.reviews r
      where r.user_id = auth.uid() and r.location_id = user_locations.location_id
    )
  );

-- Reviews
create policy "read approved, own, or admin" on public.reviews
  for select to anon, authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());

create policy "insert own for attended campus" on public.reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.user_locations ul
      where ul.user_id = auth.uid() and ul.location_id = reviews.location_id
    )
  );

create policy "update own" on public.reviews
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "delete own" on public.reviews
  for delete to authenticated using (user_id = auth.uid());

-- Ratings follow their review
create policy "read ratings of visible reviews" on public.review_ratings
  for select to anon, authenticated
  using (exists (
    select 1 from public.reviews r
    where r.id = review_ratings.review_id
      and (r.status = 'approved' or r.user_id = auth.uid() or public.is_admin())
  ));

-- Ratings can only be written while the review is pending. submit_review()
-- puts the review back to pending (and enforces the cooldown) before it
-- rewrites ratings, so this blocks editing an approved review's stars
-- directly through the REST API.
create policy "write ratings on own pending review" on public.review_ratings
  for all to authenticated
  using (exists (
    select 1 from public.reviews r
    where r.id = review_ratings.review_id and r.user_id = auth.uid() and r.status = 'pending'
  ))
  with check (exists (
    select 1 from public.reviews r
    where r.id = review_ratings.review_id and r.user_id = auth.uid() and r.status = 'pending'
  ));

-- Photos follow their review
create policy "read photos of visible reviews" on public.review_photos
  for select to anon, authenticated
  using (exists (
    select 1 from public.reviews r
    where r.id = review_photos.review_id
      and (r.status = 'approved' or r.user_id = auth.uid() or public.is_admin())
  ));

-- Photos can only be attached while the review is pending, so new photos are
-- never published without the review going back through moderation. The path
-- must be in the user's own storage folder.
create policy "add photos to own pending review" on public.review_photos
  for insert to authenticated
  with check (
    split_part(storage_path, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.reviews r
      where r.id = review_photos.review_id and r.user_id = auth.uid() and r.status = 'pending'
    )
  );

create policy "delete photos from own review" on public.review_photos
  for delete to authenticated
  using (exists (
    select 1 from public.reviews r
    where r.id = review_photos.review_id and r.user_id = auth.uid()
  ));
