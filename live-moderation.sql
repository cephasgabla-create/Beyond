-- Beyond Live moderation
create table if not exists public.live_moderation (
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('muted','blocked')),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.live_moderation enable row level security;

drop policy if exists "Live participants can read moderation" on public.live_moderation;
create policy "Live participants can read moderation"
on public.live_moderation for select to authenticated
using (exists (select 1 from public.live_rooms r where r.id=room_id and r.status='live' and (r.creator_id=auth.uid() or exists (select 1 from public.live_viewers v where v.room_id=r.id and v.user_id=auth.uid()))));

drop policy if exists "Creators can moderate live users" on public.live_moderation;
create policy "Creators can moderate live users"
on public.live_moderation for insert to authenticated
with check (exists (select 1 from public.live_rooms r where r.id=room_id and r.creator_id=auth.uid()));

drop policy if exists "Creators can update live moderation" on public.live_moderation;
create policy "Creators can update live moderation"
on public.live_moderation for update to authenticated
using (exists (select 1 from public.live_rooms r where r.id=room_id and r.creator_id=auth.uid()))
with check (exists (select 1 from public.live_rooms r where r.id=room_id and r.creator_id=auth.uid()));

drop policy if exists "Creators can remove live moderation" on public.live_moderation;
create policy "Creators can remove live moderation"
on public.live_moderation for delete to authenticated
using (exists (select 1 from public.live_rooms r where r.id=room_id and r.creator_id=auth.uid()));

create index if not exists live_moderation_room_idx on public.live_moderation(room_id, created_at desc);

do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_moderation') then
  alter publication supabase_realtime add table public.live_moderation;
 end if;
end $$;