-- Report button (docs/proposal.md §8): any member can report an approved review.
-- Reporting immediately hides it (status -> flagged) until an admin decides.

create table public.review_reports (
  id          bigint generated always as identity primary key,
  review_id   bigint not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null check (char_length(reason) between 5 and 500),
  created_at  timestamptz not null default now(),
  constraint one_report_per_user unique (review_id, reporter_id)
);
create index review_reports_review_idx on public.review_reports (review_id);

alter table public.review_reports enable row level security;

-- Only admins read reports. Inserts go through report_review() below.
create policy "admins read reports" on public.review_reports
  for select to authenticated using (public.is_admin());

-- Runs as owner so it can flag someone else's review; all checks are explicit.
create or replace function public.report_review(p_review_id bigint, p_reason text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then
    raise exception 'Sign in to report a review';
  end if;
  if char_length(v_reason) not between 5 and 500 then
    raise exception 'Please give a reason (5–500 characters)';
  end if;
  if not exists (
    select 1 from public.reviews
    where id = p_review_id and status = 'approved' and user_id <> v_uid
  ) then
    raise exception 'This review can''t be reported';
  end if;
  if (select count(*) from public.review_reports
      where reporter_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You can report at most 5 reviews per day';
  end if;

  insert into public.review_reports (review_id, reporter_id, reason)
  values (p_review_id, v_uid, v_reason)
  on conflict (review_id, reporter_id) do nothing;

  update public.reviews
  set status = 'flagged',
      moderation_notes = 'Reported: ' || v_reason
  where id = p_review_id;
end;
$$;

revoke execute on function public.report_review(bigint, text) from anon, public;
grant execute on function public.report_review(bigint, text) to authenticated;
