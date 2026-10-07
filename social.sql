-- Beyond social interactions: likes, comments and views
create table if not exists public.video_likes (
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);

create table if not exists public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  comment text not null check (char_length(comment) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.video_views (
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  viewed_at timestamptz not null default now()
);

alter table public.video_likes enable row level security;
alter table public.video_comments enable row level security;
alter table public.video_views enable row level security;

drop policy if exists "Anyone can view likes" on public.video_likes;
create policy "Anyone can view likes" on public.video_likes for select using (true);

drop policy if exists "Users can like videos" on public.video_likes;
create policy "Users can like videos" on public.video_likes
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can remove their likes" on public.video_likes;
create policy "Users can remove their likes" on public.video_likes
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Anyone can view comments" on public.video_comments;
create policy "Anyone can view comments" on public.video_comments for select using (true);

drop policy if exists "Users can add comments" on public.video_comments;
create policy "Users can add comments" on public.video_comments
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can delete their comments" on public.video_comments;
create policy "Users can delete their comments" on public.video_comments
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Anyone can view video views" on public.video_views;
create policy "Anyone can view video views" on public.video_views for select using (true);

drop policy if exists "Anyone can record a view" on public.video_views;
create policy "Anyone can record a view" on public.video_views
for insert with check (user_id is null or auth.uid() = user_id);

create index if not exists video_likes_video_id_idx on public.video_likes(video_id);
create index if not exists video_comments_video_id_idx on public.video_comments(video_id);
create index if not exists video_views_video_id_idx on public.video_views(video_id);
