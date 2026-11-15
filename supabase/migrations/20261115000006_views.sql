-- Score views (docs/proposal.md §4.4, §5.6)
-- security_invoker: views respect the caller's RLS, so only approved reviews count.

create view public.location_category_scores with (security_invoker = true) as
select
  r.location_id,
  rr.category,
  round(avg(rr.stars)::numeric, 2) as avg_stars,
  count(*)                          as rating_count
from public.reviews r
join public.review_ratings rr on rr.review_id = r.id
where r.status = 'approved'
group by r.location_id, rr.category;

-- ranked_score = (C*m + n*overall) / (C + n), C = 5, m = global mean rating
create view public.location_scores with (security_invoker = true) as
with global as (
  select coalesce(avg(rr.stars), 3)::numeric as m
  from public.review_ratings rr
  join public.reviews r on r.id = rr.review_id
  where r.status = 'approved'
),
per_location as (
  select
    l.id as location_id,
    l.slug,
    l.name,
    (select count(*) from public.reviews r
      where r.location_id = l.id and r.status = 'approved') as review_count,
    (select round(avg(s.avg_stars), 2) from public.location_category_scores s
      where s.location_id = l.id) as overall_avg
  from public.locations l
)
select
  p.*,
  round(
    (5 * g.m + p.review_count * coalesce(p.overall_avg, g.m)) / (5 + p.review_count),
    2
  ) as ranked_score
from per_location p cross join global g;
