-- Seed data (docs/proposal.md §5.8). Safe to re-run.
-- TODO(team): finalize descriptions, cover_image_url, NUin/Dialogue locations,
-- and the program → location mapping (open item in docs/proposal.md §12).

-- ---------------------------------------------------------------------------
-- Northeastern global campus network
-- ---------------------------------------------------------------------------
insert into public.locations (slug, name, city, country, description) values
  ('boston',         'Boston',         'Boston',         'United States',  'Northeastern''s main campus in the Fenway neighborhood.'),
  ('arlington',      'Arlington',      'Arlington',      'United States',  'Graduate campus in the Washington, D.C. area.'),
  ('burlington',     'Burlington',     'Burlington',     'United States',  'Research and graduate campus north of Boston.'),
  ('charlotte',      'Charlotte',      'Charlotte',      'United States',  'Graduate campus in uptown Charlotte, North Carolina.'),
  ('london',         'London',         'London',         'United Kingdom', 'Northeastern University London, in central London.'),
  ('miami',          'Miami',          'Miami',          'United States',  'Graduate campus in Miami, Florida.'),
  ('nahant',         'Nahant',         'Nahant',         'United States',  'Marine Science Center on the Nahant peninsula.'),
  ('oakland',        'Oakland',        'Oakland',        'United States',  'Mills College at Northeastern University in Oakland, California.'),
  ('portland',       'Portland',       'Portland',       'United States',  'The Roux Institute in Portland, Maine.'),
  ('seattle',        'Seattle',        'Seattle',        'United States',  'Graduate campus in South Lake Union, Seattle.'),
  ('silicon-valley', 'Silicon Valley', 'San Jose',       'United States',  'Graduate campus in San Jose, California.'),
  ('toronto',        'Toronto',        'Toronto',        'Canada',         'Graduate campus in downtown Toronto.'),
  ('vancouver',      'Vancouver',      'Vancouver',      'Canada',         'Campus in downtown Vancouver, British Columbia.')
on conflict (slug) do nothing;

-- TODO(team): add NUin and Dialogue of Civilizations host locations here.

-- ---------------------------------------------------------------------------
-- Programs
-- ---------------------------------------------------------------------------
insert into public.programs (slug, name, description) values
  ('nuin',     'NUin',                        'First-year program where students start at a campus or partner institution outside Boston.'),
  ('dialogue', 'Dialogue of Civilizations',   'Faculty-led summer study abroad programs.')
on conflict (slug) do nothing;

-- TODO(team): verify and complete this mapping.
insert into public.program_locations (program_id, location_id)
select p.id, l.id
from public.programs p
join public.locations l on l.slug in ('london', 'oakland')
where p.slug = 'nuin'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Sample reviews (DEV ONLY) so the frontend has data before real reviews exist.
-- Uses @example.com users (reserved domain, can't receive email or sign in).
-- Inserted as postgres, so the NU-email backstop trigger doesn't apply.
-- Remove before launch:  delete from auth.users where email like 'seed-%@example.com';
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'seed-1@example.com'),
  ('00000000-0000-0000-0000-00000000a002'::uuid, 'seed-2@example.com'),
  ('00000000-0000-0000-0000-00000000a003'::uuid, 'seed-3@example.com')
) as u(id, email)
on conflict (id) do nothing;

insert into public.user_locations (user_id, location_id, first_term)
select v.user_id, l.id, v.term
from (values
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'boston', 'Fall 2024'),
  ('00000000-0000-0000-0000-00000000a002'::uuid, 'boston', 'Fall 2025'),
  ('00000000-0000-0000-0000-00000000a003'::uuid, 'boston', 'Spring 2025'),
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'london', 'Fall 2023')
) as v(user_id, slug, term)
join public.locations l on l.slug = v.slug
on conflict do nothing;

insert into public.reviews (user_id, location_id, attended_term, comment, status)
select v.user_id, l.id, '', v.comment, 'approved'
from (values
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'boston',
   'Great co-op connections and the Fenway area is beautiful. Dining halls are fine but get repetitive by spring.'),
  ('00000000-0000-0000-0000-00000000a002'::uuid, 'boston',
   'Classes are demanding but professors are approachable. Housing is expensive and the first-year dorms are small.'),
  ('00000000-0000-0000-0000-00000000a003'::uuid, 'boston',
   'Tons of clubs and things to do in the city. Rent and food off campus add up fast, budget carefully.'),
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'london',
   'Living in central London was incredible. Small class sizes, but everything costs a lot and the dorm was dated.')
) as v(user_id, slug, comment)
join public.locations l on l.slug = v.slug
on conflict (user_id, location_id) do nothing;

insert into public.review_ratings (review_id, category, stars)
select r.id, v.category::public.rating_category, v.stars
from (values
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'boston', 'food', 3),
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'boston', 'surroundings', 5),
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'boston', 'education', 4),
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'boston', 'campus', 5),
  ('00000000-0000-0000-0000-00000000a002'::uuid, 'boston', 'education', 5),
  ('00000000-0000-0000-0000-00000000a002'::uuid, 'boston', 'prices', 2),
  ('00000000-0000-0000-0000-00000000a002'::uuid, 'boston', 'dorm', 2),
  ('00000000-0000-0000-0000-00000000a003'::uuid, 'boston', 'social', 5),
  ('00000000-0000-0000-0000-00000000a003'::uuid, 'boston', 'prices', 2),
  ('00000000-0000-0000-0000-00000000a003'::uuid, 'boston', 'food', 3),
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'london', 'surroundings', 5),
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'london', 'education', 4),
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'london', 'prices', 1),
  ('00000000-0000-0000-0000-00000000a001'::uuid, 'london', 'dorm', 2)
) as v(user_id, slug, category, stars)
join public.locations l on l.slug = v.slug
join public.reviews r on r.user_id = v.user_id and r.location_id = l.id
on conflict do nothing;
