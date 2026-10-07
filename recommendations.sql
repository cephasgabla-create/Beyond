create table if not exists public.video_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('view','like','comment')),
  created_at timestamptz not null default now()
);

alter table public.video_interactions enable row level security;

drop policy if exists "Users can view their interactions" on public.video_interactions;
create policy "Users can view their interactions" on public.video_interactions
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can create their interactions" on public.video_interactions;
create policy "Users can create their interactions" on public.video_interactions
for insert to authenticated with check (auth.uid() = user_id);

create index if not exists video_interactions_user_idx
on public.video_interactions(user_id, created_at desc);

create index if not exists video_interactions_video_idx
on public.video_interactions(video_id);