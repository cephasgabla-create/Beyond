-- Beyond Live WebRTC signaling
create table if not exists public.live_signals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer','answer','ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.live_signals enable row level security;

drop policy if exists "Live participants can read signals" on public.live_signals;
create policy "Live participants can read signals"
on public.live_signals for select to authenticated
using (
  sender_id = auth.uid()
  or receiver_id = auth.uid()
  or exists (
    select 1 from public.live_rooms r
    where r.id = room_id
      and r.status = 'live'
  )
);

drop policy if exists "Live participants can send signals" on public.live_signals;
create policy "Live participants can send signals"
on public.live_signals for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.live_rooms r
    where r.id = room_id
      and r.status = 'live'
  )
);

create index if not exists live_signals_room_created_idx
on public.live_signals(room_id, created_at);

create index if not exists live_signals_receiver_idx
on public.live_signals(receiver_id, created_at);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_signals'
  ) then
    alter publication supabase_realtime add table public.live_signals;
  end if;
end $$;