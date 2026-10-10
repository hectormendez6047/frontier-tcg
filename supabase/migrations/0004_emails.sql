-- Frontier TCG — update 4: newsletter, back-in-stock alerts and email history.
-- Run once in Supabase: SQL Editor → New query → paste everything → Run. Safe to re-run.

-- People who signed up for emails without an account (homepage / coming-soon form).
create table if not exists public.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  topics          text[] not null default array['promotions','new_products','restocks','events','rewards','announcements'],
  source          text,
  created_at      timestamptz not null default now(),
  unsubscribed_at timestamptz
);

-- "Email me when it's back in stock" requests.
create table if not exists public.stock_alerts (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  email       text not null,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  notified_at timestamptz,
  unique (product_id, email)
);
create index if not exists stock_alerts_waiting on public.stock_alerts (product_id) where notified_at is null;

-- Newsletters that were sent.
create table if not exists public.email_campaigns (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,
  topic       text not null,
  body        text not null,
  sent_count  integer not null default 0,
  failed      integer not null default 0,
  sent_by     uuid references auth.users(id) on delete set null,
  sent_by_email text,
  created_at  timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;
alter table public.stock_alerts           enable row level security;
alter table public.email_campaigns        enable row level security;

-- Staff can read these; all changes go through the website's server.
drop policy if exists ns_staff on public.newsletter_subscribers;
create policy ns_staff on public.newsletter_subscribers for select using (public.is_admin());
drop policy if exists sa_staff on public.stock_alerts;
create policy sa_staff on public.stock_alerts for select using (public.is_staff() or user_id = auth.uid());
drop policy if exists ec_staff on public.email_campaigns;
create policy ec_staff on public.email_campaigns for select using (public.is_admin());
revoke insert, update, delete on public.newsletter_subscribers, public.stock_alerts, public.email_campaigns from anon, authenticated;

-- Everyone who has opted in to a topic: account holders and newsletter subscribers, one row per email.
create or replace function public.email_audience(p_topic text)
returns table (email text, name text)
language sql stable security definer set search_path = public as $$
  with acct as (
    select lower(u.email) as email, p.full_name as name
    from public.profiles p join auth.users u on u.id = p.id
    where u.email is not null and u.email_confirmed_at is not null
      and (coalesce((p.email_prefs->>p_topic)::boolean, false)
           or (p.email_prefs = '{}'::jsonb and p.marketing_opt_in))
  ),
  subs as (
    select lower(s.email) as email, null::text as name
    from public.newsletter_subscribers s
    where s.unsubscribed_at is null and p_topic = any(s.topics)
  )
  select distinct on (email) email, name from (select * from acct union all select * from subs) x order by email, name nulls last
$$;
revoke execute on function public.email_audience from public, anon, authenticated;
grant execute on function public.email_audience to service_role;

-- Turn off all marketing email for an address (used by unsubscribe links).
create or replace function public.email_unsubscribe(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.newsletter_subscribers set unsubscribed_at = coalesce(unsubscribed_at, now()) where lower(email) = lower(p_email);
  update public.profiles p set email_prefs = '{}'::jsonb, marketing_opt_in = false
  from auth.users u where u.id = p.id and lower(u.email) = lower(p_email);
end $$;
revoke execute on function public.email_unsubscribe from public, anon, authenticated;
grant execute on function public.email_unsubscribe to service_role;
