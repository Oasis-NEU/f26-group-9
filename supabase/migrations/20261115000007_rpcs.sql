-- RPCs (docs/proposal.md §5.7)

-- Create or edit a review + its ratings + new photos atomically.
-- p_ratings: {"food": 4, "dorm": 5}; omitted categories = N/A.
-- p_photo_paths: storage paths the client already uploaded to review-photos
--   ({user_id}/{uuid}.webp). Linking them here, in the same transaction that
--   resets the review to pending, means moderation always sees the photos and
--   there's no race with the webhook approving the review mid-upload.
-- Runs as the caller, so the review triggers (pending, cooldown, photo cap) and RLS apply.
create or replace function public.submit_review(
  p_location_id bigint,
  p_comment     text,
  p_ratings     jsonb,
  p_photo_paths text[] default '{}'
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

  -- one row at a time so the photo cap trigger counts correctly
  declare
    v_path text;
  begin
    foreach v_path in array coalesce(p_photo_paths, '{}') loop
      insert into public.review_photos (review_id, storage_path) values (v_review_id, v_path);
    end loop;
  end;

  return v_review_id;
end;
$$;

revoke execute on function public.submit_review(bigint, text, jsonb, text[]) from anon, public;
grant execute on function public.submit_review(bigint, text, jsonb, text[]) to authenticated;

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
       or l2.country ilike '%' || q || '%'
    union
    select pl.location_id
    from public.program_locations pl
    join public.programs p on p.id = pl.program_id
    where p.search @@ websearch_to_tsquery('english', q)
       or p.name ilike '%' || q || '%'
  )
  order by l.name;
$$;

-- Admin moderation decision. Runs as owner, so user-edit trigger rules are skipped.
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

revoke execute on function public.moderate_review(bigint, public.review_status) from anon, public;
grant execute on function public.moderate_review(bigint, public.review_status) to authenticated;
