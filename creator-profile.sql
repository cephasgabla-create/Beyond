create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null check (char_length(username) between 3 and 30),
 display_name text not null default 'Beyond Creator',
 bio text not null default '' check (char_length(bio) <= 150),
 avatar_url text, created_at timestamptz not null default now()
);
create table if not exists public.follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 following_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (follower_id, following_id),
 check (follower_id <> following_id)
);
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
drop policy if exists "Anyone can view profiles" on public.profiles;
create policy "Anyone can view profiles" on public.profiles for select using (true);
drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Anyone can view follows" on public.follows;
create policy "Anyone can view follows" on public.follows for select using (true);
drop policy if exists "Users can follow creators" on public.follows;
create policy "Users can follow creators" on public.follows for insert to authenticated with check (auth.uid() = follower_id and follower_id <> following_id);
drop policy if exists "Users can unfollow creators" on public.follows;
create policy "Users can unfollow creators" on public.follows for delete to authenticated using (auth.uid() = follower_id);
create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists follows_following_id_idx on public.follows(following_id);