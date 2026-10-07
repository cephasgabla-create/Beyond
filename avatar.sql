insert into storage.buckets (id, name, public) values ('avatars','avatars',true) on conflict (id) do update set public=true;

drop policy if exists "Anyone can view Beyond avatars" on storage.objects;
create policy "Anyone can view Beyond avatars" on storage.objects for select using (bucket_id='avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects for insert to authenticated
with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects for update to authenticated
using (bucket_id='avatars' and owner_id=(select auth.uid()::text))
with check (bucket_id='avatars' and owner_id=(select auth.uid()::text));

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar" on storage.objects for delete to authenticated
using (bucket_id='avatars' and owner_id=(select auth.uid()::text));