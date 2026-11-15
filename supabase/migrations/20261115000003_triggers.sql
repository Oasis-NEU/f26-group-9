-- Limits and integrity triggers (docs/proposal.md §5.3)
-- current_user = 'authenticated' means a signed-in user via the API.
-- The backend (service_role) and security-definer functions skip user rules.

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
  before insert on public.user_locations
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
  before insert on public.reviews
  for each row execute function public.reviews_before_insert();

-- Review update: cooldown, lock identity fields, re-moderate.
-- updated_at is only bumped on user edits, so moderation status changes
-- by the backend/admin don't restart the user's 1-hour edit cooldown.
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
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger reviews_update
  before update on public.reviews
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
  before insert on public.review_photos
  for each row execute function public.enforce_photo_cap();
