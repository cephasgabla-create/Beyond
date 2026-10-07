create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('comment','like','follow')),
  video_id uuid references public.videos(id) on delete cascade,
  comment_id uuid references public.video_comments(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Users can view their notifications" on public.notifications;
create policy "Users can view their notifications" on public.notifications
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can mark notifications read" on public.notifications;
create policy "Users can mark notifications read" on public.notifications
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists notifications_user_created_idx
on public.notifications(user_id, created_at desc);

create or replace function public.create_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  actor_name text;
begin
  select user_id into owner_id from public.videos where id = new.video_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;

  select coalesce(display_name, username, 'Someone') into actor_name
  from public.profiles where id = new.user_id;

  insert into public.notifications(user_id, actor_id, type, video_id, comment_id, message)
  values (owner_id, new.user_id, 'comment', new.video_id, new.id, actor_name || ' commented on your video');
  return new;
end;
$$;

drop trigger if exists comment_notification_trigger on public.video_comments;
create trigger comment_notification_trigger
after insert on public.video_comments
for each row execute function public.create_comment_notification();


create or replace function public.create_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  actor_name text;
begin
  select user_id into owner_id from public.videos where id = new.video_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;

  select coalesce(display_name, username, 'Someone') into actor_name
  from public.profiles where id = new.user_id;

  insert into public.notifications(user_id, actor_id, type, video_id, message)
  values (owner_id, new.user_id, 'like', new.video_id, actor_name || ' liked your video');

  return new;
end;
$$;

drop trigger if exists like_notification_trigger on public.video_likes;
create trigger like_notification_trigger
after insert on public.video_likes
for each row execute function public.create_like_notification();

create or replace function public.create_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  if new.follower_id = new.following_id then return new; end if;

  select coalesce(display_name, username, 'Someone') into actor_name
  from public.profiles where id = new.follower_id;

  insert into public.notifications(user_id, actor_id, type, message)
  values (new.following_id, new.follower_id, 'follow', actor_name || ' started following you');

  return new;
end;
$$;

drop trigger if exists follow_notification_trigger on public.follows;
create trigger follow_notification_trigger
after insert on public.follows
for each row execute function public.create_follow_notification();
