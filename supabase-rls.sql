-- Beyond: Supabase database + Storage RLS setup
-- Run this file in Supabase Dashboard -> SQL Editor.
-- Never put a service_role/secret key in frontend code.

-- 1. Videos table
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_url text not null,
  storage_path text not null,
  caption text default '',
  created_at timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.videos enable row level security;

-- 3. Videos policies
drop policy if exists "Anyone can view videos" on public.videos;
create policy "Anyone can view videos"
on public.videos
for select
using (true);

drop policy if exists "Users can create their own videos" on public.videos;
create policy "Users can create their own videos"
on public.videos
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own videos" on public.videos;
create policy "Users can update their own videos"
on public.videos
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own videos" on public.videos;
create policy "Users can delete their own videos"
on public.videos
for delete
to authenticated
using (auth.uid() = user_id);

-- 4. Public videos Storage bucket
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do update
set public = true;

-- 5. Storage policies
drop policy if exists "Users can upload their own videos" on storage.objects;
create policy "Users can upload their own videos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update their own video files" on storage.objects;
create policy "Users can update their own video files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'videos'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'videos'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists "Users can delete their own video files" on storage.objects;
create policy "Users can delete their own video files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'videos'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists "Anyone can view Beyond videos" on storage.objects;
create policy "Anyone can view Beyond videos"
on storage.objects
for select
using (bucket_id = 'videos');
