create table if not exists public.video_reports (
 id uuid primary key default gen_random_uuid(),
 video_id uuid not null references public.videos(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check (reason in ('spam','harassment','copyright','unsafe','other')),
 details text not null default '' check (char_length(details) <= 500),
 created_at timestamptz not null default now(),
 unique(video_id, reporter_id)
);
alter table public.video_reports enable row level security;
drop policy if exists "Users can report videos" on public.video_reports;
create policy "Users can report videos" on public.video_reports for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "Users can view their reports" on public.video_reports;
create policy "Users can view their reports" on public.video_reports for select to authenticated using (auth.uid() = reporter_id);
create index if not exists video_reports_video_idx on public.video_reports(video_id, created_at desc);