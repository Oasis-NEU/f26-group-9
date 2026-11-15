-- Auth: NU-only domain gate, profile creation, admin check (docs/proposal.md §5.2)

-- Before User Created hook: reject non-NU emails with a friendly message.
-- Enable in Dashboard → Authentication → Hooks → "Before User Created".
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

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_nu_email_only(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_nu_email_only(jsonb) from authenticated, anon, public;

-- Backstop in case the hook is disabled or unavailable on our plan.
-- Only applies to signups coming through Supabase Auth (supabase_auth_admin),
-- so seed scripts run as postgres can still create sample users.
create or replace function public.enforce_nu_email()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'supabase_auth_admin'
     and (new.email is null or lower(new.email) not like '%@northeastern.edu') then
    raise exception 'Please sign in with your @northeastern.edu email.';
  end if;
  return new;
end;
$$;

create trigger enforce_nu_email
  before insert on auth.users
  for each row execute function public.enforce_nu_email();

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
