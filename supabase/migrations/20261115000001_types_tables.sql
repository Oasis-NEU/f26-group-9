-- Types and tables (docs/proposal.md §5.1)

create type public.rating_category as enum
  ('food', 'surroundings', 'social', 'education', 'prices', 'dorm', 'campus');

create type public.review_status as enum ('pending', 'approved', 'flagged', 'rejected');

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.locations (
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
create index locations_search_idx on public.locations using gin (search);

create table public.programs (
  id          bigint generated always as identity primary key,
  slug        text unique not null,
  name        text not null,
  description text,
  search      tsvector generated always as (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored
);
create index programs_search_idx on public.programs using gin (search);

create table public.program_locations (
  program_id  bigint references public.programs(id) on delete cascade,
  location_id bigint references public.locations(id) on delete cascade,
  primary key (program_id, location_id)
);

create table public.user_locations (
  user_id     uuid references public.profiles(id) on delete cascade,
  location_id bigint references public.locations(id) on delete cascade,
  first_term  text not null,                 -- e.g. 'Fall 2025'
  created_at  timestamptz not null default now(),
  primary key (user_id, location_id)
);

create table public.reviews (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  location_id      bigint not null references public.locations(id) on delete cascade,
  attended_term    text not null,            -- copied from user_locations by trigger
  comment          text not null check (char_length(comment) between 20 and 3000),
  status           public.review_status not null default 'pending',
  moderation_notes text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint one_review_per_location unique (user_id, location_id)
);
create index reviews_location_status_idx on public.reviews (location_id, status);

create table public.review_ratings (
  review_id bigint references public.reviews(id) on delete cascade,
  category  public.rating_category not null,
  stars     smallint not null check (stars between 1 and 5),
  primary key (review_id, category)          -- N/A = no row
);

create table public.review_photos (
  id           bigint generated always as identity primary key,
  review_id    bigint not null references public.reviews(id) on delete cascade,
  storage_path text not null unique,
  created_at   timestamptz not null default now()
);

create table public.location_summaries (
  location_id  bigint primary key references public.locations(id) on delete cascade,
  summary      jsonb not null,
  review_count int not null,
  model        text not null,
  updated_at   timestamptz not null default now()
);
