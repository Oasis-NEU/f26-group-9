-- Review photo storage (docs/proposal.md §4.5, §5.5)
-- Path format: {user_id}/{uuid}.webp (uploaded before submit_review, which links it)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "read photos of approved, own, or admin reviews" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'review-photos'
    and exists (
      select 1 from public.review_photos p
      join public.reviews r on r.id = p.review_id
      where p.storage_path = storage.objects.name
        and (r.status = 'approved' or r.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "delete own photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
