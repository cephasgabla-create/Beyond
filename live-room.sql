-- Beyond Live Room
create table if not exists public.live_rooms (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Beyond Live' check (char_length(title) between 1 and 120),
  category text not null default 'Chat' check (category in ('Gaming','Music','Sports','Chat','Education')),
  status text not null default 'live' check (status in ('live','ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now()
);

create table if not exists public.live_reactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like','love','fire','wow')),
  created_at timestamptz not null default now()
);

create table if not exists public.live_viewers (
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id,user_id)
);

alter table public.live_rooms enable row level security;
alter table public.live_chat_messages enable row level security;
alter table public.live_reactions enable row level security;
alter table public.live_viewers enable row level security;

drop policy if exists "Anyone can view live rooms" on public.live_rooms;
create policy "Anyone can view live rooms" on public.live_rooms for select using (true);
drop policy if exists "Users can start live rooms" on public.live_rooms;
create policy "Users can start live rooms" on public.live_rooms for insert to authenticated with check (auth.uid() = creator_id);
drop policy if exists "Creators can end their live rooms" on public.live_rooms;
create policy "Creators can end their live rooms" on public.live_rooms for update to authenticated using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

drop policy if exists "Anyone can read live chat" on public.live_chat_messages;
create policy "Anyone can read live chat" on public.live_chat_messages for select using (true);
drop policy if exists "Users can send live chat" on public.live_chat_messages;
create policy "Users can send live chat" on public.live_chat_messages for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Anyone can read live reactions" on public.live_reactions;
create policy "Anyone can read live reactions" on public.live_reactions for select using (true);
drop policy if exists "Users can send live reactions" on public.live_reactions;
create policy "Users can send live reactions" on public.live_reactions for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Anyone can read live viewers" on public.live_viewers;
create policy "Anyone can read live viewers" on public.live_viewers for select using (true);
drop policy if exists "Users can join live rooms" on public.live_viewers;
create policy "Users can join live rooms" on public.live_viewers for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their live presence" on public.live_viewers;
create policy "Users can update their live presence" on public.live_viewers for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can leave live rooms" on public.live_viewers;
create policy "Users can leave live rooms" on public.live_viewers for delete to authenticated using (auth.uid() = user_id);

create index if not exists live_rooms_category_idx on public.live_rooms(category, started_at desc);
create index if not exists live_rooms_status_idx on public.live_rooms(status, started_at desc);
create index if not exists live_chat_room_idx on public.live_chat_messages(room_id, created_at);
create index if not exists live_reactions_room_idx on public.live_reactions(room_id, created_at);
create index if not exists live_viewers_room_idx on public.live_viewers(room_id, last_seen_at);


-- Enable Supabase Realtime for the live-room tables.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_chat_messages') then
    alter publication supabase_realtime add table public.live_chat_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_reactions') then
    alter publication supabase_realtime add table public.live_reactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_viewers') then
    alter publication supabase_realtime add table public.live_viewers;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_rooms') then
    alter publication supabase_realtime add table public.live_rooms;
  end if;
end $$;

create unique index if not exists live_one_active_room_per_creator_idx
on public.live_rooms(creator_id)
where status = 'live';
