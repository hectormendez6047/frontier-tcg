-- Frontier TCG — initial schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
grant usage on schema extensions to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Roles and profiles
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type public.app_role as enum ('owner','admin','staff','customer');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  role        public.app_role not null default 'customer',
  marketing_opt_in boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Create a profile for every new sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helpers. SECURITY DEFINER so they can read profiles without tripping RLS.
create or replace function public.current_role_name()
returns public.app_role language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'customer'::public.app_role)
$$;
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.current_role_name() in ('owner','admin','staff')
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.current_role_name() in ('owner','admin')
$$;
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.current_role_name() = 'owner'
$$;

-- Users may not change their own role; only the owner can change roles.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  -- auth.uid() is null when you run SQL directly in the Supabase SQL editor (that's how you make the first owner).
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_owner() then
    raise exception 'Only the store owner can change roles';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ─────────────────────────────────────────────────────────────
-- Inventory locations
-- ─────────────────────────────────────────────────────────────
create table if not exists public.inventory_locations (
  id         smallint generated always as identity primary key,
  name       text not null unique,
  sort       smallint not null default 0,
  created_at timestamptz not null default now()
);
insert into public.inventory_locations (name, sort) values
  ('Online',1),('Main Store',2),('Display Case',3),('Storage',4),('Bulk',5)
on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Products
-- ─────────────────────────────────────────────────────────────
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  sku               text not null unique,
  slug              text not null unique,
  name              text not null check (length(name) between 1 and 200),
  product_type      text not null default 'single'
                      check (product_type in ('single','sealed','sports','accessory','bulk','collectible')),
  game              text,               -- Pokémon, One Piece, Football, Basketball…
  set_name          text,
  card_number       text,
  rarity            text,
  card_type         text,
  player            text,
  team              text,
  year              text,
  manufacturer      text,
  rookie            boolean not null default false,
  parallel          text,
  is_insert         boolean not null default false,
  holo              boolean not null default false,
  language          text default 'English',
  condition         text,
  price             numeric(10,2) not null check (price >= 0),
  sale_price        numeric(10,2) check (sale_price is null or sale_price >= 0),
  compare_at_price  numeric(10,2) check (compare_at_price is null or compare_at_price >= 0),
  cost              numeric(10,2) check (cost is null or cost >= 0),
  quantity          integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  available_quantity integer generated always as (greatest(quantity - reserved_quantity, 0)) stored,
  location_id       smallint references public.inventory_locations(id) on delete set null,
  description       text,
  notes             text,               -- internal, staff only (hidden from the public view)
  tags              text[] not null default '{}',
  status            text not null default 'active' check (status in ('active','draft','archived')),
  featured          boolean not null default false,
  is_demo           boolean not null default false,
  square_catalog_id text,               -- filled in when Square sync is connected
  search_text       text not null default '',
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint reserved_le_quantity check (reserved_quantity <= quantity)
);

create index if not exists products_search_trgm on public.products using gin (search_text extensions.gin_trgm_ops);
create index if not exists products_status_type on public.products (status, product_type);
create index if not exists products_game on public.products (game) where status = 'active';
create index if not exists products_created on public.products (created_at desc);
create index if not exists products_featured on public.products (featured) where featured;
create index if not exists products_price on public.products (price);

create or replace function public.slugify(t text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(t,''))), '[^a-z0-9]+', '-', 'g'))
$$;

-- Keep slug, search text and updated_at in sync on every write.
create or replace function public.products_before_write()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := left(public.slugify(new.name), 60) || '-' || left(public.slugify(new.sku), 30);
  end if;
  new.search_text := lower(extensions.unaccent(concat_ws(' ',
    new.name, new.sku, new.game, new.set_name, new.card_number,
    replace(coalesce(new.card_number,''), '/', ' '),
    new.rarity, new.card_type, new.player, new.team, new.year, new.manufacturer,
    new.parallel, new.condition, new.product_type,
    case when new.rookie then 'rookie rc' end,
    case when new.is_insert then 'insert' end,
    case when new.holo then 'holo foil' end,
    array_to_string(new.tags, ' '))));
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists products_bw on public.products;
create trigger products_bw before insert or update on public.products
  for each row execute function public.products_before_write();

-- ─────────────────────────────────────────────────────────────
-- Product images (files live in Supabase Storage, not in the database)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path       text not null unique,   -- object path inside the "product-images" bucket
  alt        text,
  position   integer not null default 0,
  width      integer,
  height     integer,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product on public.product_images (product_id, position);

-- Public product view (no cost, notes or raw stock counts).
create or replace view public.products_public
with (security_invoker = true) as
  select p.id, p.sku, p.slug, p.name, p.product_type, p.game, p.set_name, p.card_number, p.rarity,
         p.card_type, p.player, p.team, p.year, p.manufacturer, p.rookie, p.parallel, p.is_insert,
         p.holo, p.language, p.condition, p.price, p.sale_price, p.compare_at_price,
         p.available_quantity, p.description, p.tags, p.featured, p.is_demo, p.created_at, p.updated_at,
         (select i.path from public.product_images i where i.product_id = p.id order by i.position, i.created_at limit 1) as image_path
  from public.products p
  where p.status = 'active';

-- ─────────────────────────────────────────────────────────────
-- Store settings (single row)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.store_settings (
  id         smallint primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id, data) values (1, jsonb_build_object(
  'storeName','Frontier TCG','email','','phone','','address','Laredo, Texas',
  'heroHeadline','Trading Cards • Collectibles • Community',
  'heroCopy','Singles, sealed product, sports cards, accessories and local gaming events for collectors, players and the next card on your want list.',
  'announcement','',
  'shippingEnabled',true,'shippingFlat',4.99,'freeShippingOver',75,
  'pickupEnabled',false,'pickupFee',2,
  'lowStock',3,
  'pointsPerDollar',1,'rewardThreshold',100,'rewardAmount',5,
  'aboutText','Frontier TCG is a Laredo card shop for Pokémon, sports cards and every TCG in between. We buy, sell and trade singles and sealed product, and we host local play nights for players of every level.',
  'instagram','','facebook','','tiktok',''
)) on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Events
-- ─────────────────────────────────────────────────────────────
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  starts_on    date not null,
  start_time   text,
  description  text,
  entry_fee    numeric(10,2) not null default 0 check (entry_fee >= 0),
  capacity     integer check (capacity is null or capacity >= 0),
  registration text not null default 'walkin' check (registration in ('walkin','open','full','closed')),
  status       text not null default 'active' check (status in ('active','archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists events_date on public.events (starts_on) where status = 'active';

-- ─────────────────────────────────────────────────────────────
-- Rewards (in-store tracker; compatible with a later Square Loyalty sync)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.rewards_members (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  phone             text unique,
  email             text,
  user_id           uuid references auth.users(id) on delete set null,
  points            integer not null default 0 check (points >= 0),
  lifetime_earned   integer not null default 0,
  lifetime_redeemed integer not null default 0,
  square_customer_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists rewards_members_name on public.rewards_members using gin (lower(name) extensions.gin_trgm_ops);

create table if not exists public.rewards_transactions (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.rewards_members(id) on delete cascade,
  kind       text not null check (kind in ('purchase','redeem','adjust')),
  amount     numeric(10,2),
  points     integer not null,
  note       text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists rewards_tx_member on public.rewards_transactions (member_id, created_at desc);

-- Apply points atomically (locks the member row so two staff can't double-apply).
create or replace function public.rewards_apply(p_member uuid, p_kind text, p_amount numeric, p_note text default null)
returns public.rewards_members language plpgsql security definer set search_path = public, extensions as $$
declare
  s jsonb; m public.rewards_members; delta int;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  select data into s from public.store_settings where id = 1;
  select * into m from public.rewards_members where id = p_member for update;
  if not found then raise exception 'Member not found'; end if;

  if p_kind = 'purchase' then
    if p_amount is null or p_amount <= 0 then raise exception 'Enter the purchase total'; end if;
    delta := floor(p_amount * coalesce((s->>'pointsPerDollar')::numeric, 1));
  elsif p_kind = 'redeem' then
    delta := -coalesce((s->>'rewardThreshold')::int, 100);
    p_amount := coalesce((s->>'rewardAmount')::numeric, 5);
    if m.points + delta < 0 then raise exception 'Not enough points to redeem'; end if;
  elsif p_kind = 'adjust' then
    delta := coalesce(p_amount, 0)::int;  -- for adjustments, p_amount carries the point change
    p_amount := null;
    if m.points + delta < 0 then delta := -m.points; end if;
  else
    raise exception 'Unknown action';
  end if;

  update public.rewards_members set
    points = points + delta,
    lifetime_earned = lifetime_earned + greatest(delta, 0),
    lifetime_redeemed = lifetime_redeemed + case when p_kind = 'redeem' then -delta else 0 end,
    updated_at = now()
  where id = p_member returning * into m;

  insert into public.rewards_transactions (member_id, kind, amount, points, note, created_by)
  values (p_member, p_kind, p_amount, delta, p_note, auth.uid());
  return m;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Audit log
-- ─────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  entity_name text,
  field       text,
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_created on public.audit_logs (created_at desc);

-- Every product price/stock/status change is recorded automatically, whatever screen made it.
create or replace function public.products_audit()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  who uuid := auth.uid();
  who_email text := (select email from public.profiles where id = auth.uid());
  f text; o text; n text;
begin
  if tg_op = 'INSERT' then
    insert into audit_logs(actor_id, actor_email, action, entity, entity_id, entity_name)
    values (who, who_email, 'created', 'product', new.id::text, new.name);
    return new;
  elsif tg_op = 'DELETE' then
    insert into audit_logs(actor_id, actor_email, action, entity, entity_id, entity_name)
    values (who, who_email, 'deleted', 'product', old.id::text, old.name);
    return old;
  end if;
  foreach f in array array['name','price','sale_price','cost','quantity','reserved_quantity','status','condition','featured'] loop
    execute format('select ($1).%I::text, ($2).%I::text', f, f) into o, n using old, new;
    if o is distinct from n then
      insert into audit_logs(actor_id, actor_email, action, entity, entity_id, entity_name, field, old_value, new_value)
      values (who, who_email, 'changed', 'product', new.id::text, new.name, f, o, n);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists products_audit_trg on public.products;
create trigger products_audit_trg after insert or update or delete on public.products
  for each row execute function public.products_audit();

-- ─────────────────────────────────────────────────────────────
-- Search
-- ─────────────────────────────────────────────────────────────
create or replace function public.search_products(
  q           text    default '',
  p_category  text    default null,  -- pokemon | sports | football | basketball | baseball | soccer | tcg | sealed | accessories | bulk | collectibles
  p_game      text    default null,
  p_type      text    default null,
  p_condition text    default null,
  p_rarity    text    default null,
  p_min       numeric default null,
  p_max       numeric default null,
  p_in_stock  boolean default false,
  p_rookie    boolean default false,
  p_sort      text    default 'relevance',
  p_limit     integer default 48,
  p_offset    integer default 0
)
returns table (product jsonb, total bigint)
language sql stable security definer set search_path = public, extensions as $$
  with toks as (
    select array_remove(regexp_split_to_array(lower(extensions.unaccent(trim(coalesce(q,'')))), '\s+'), '') as t
  ),
  base as (
    select p.*,
      coalesce(p.sale_price, p.price) as eff_price,
      (select i.path from public.product_images i where i.product_id = p.id order by i.position, i.created_at limit 1) as image_path
    from public.products p, toks
    where p.status = 'active'
      and (cardinality(toks.t) = 0 or not exists (
            select 1 from unnest(toks.t) w where p.search_text not like '%' || replace(w, '#', '') || '%'))
      and (p_category is null or case p_category
            when 'pokemon'      then p.game = 'Pokémon'
            when 'sports'       then p.game in ('Football','Basketball','Baseball','Soccer') or p.product_type = 'sports'
            when 'football'     then p.game = 'Football'
            when 'basketball'   then p.game = 'Basketball'
            when 'baseball'     then p.game = 'Baseball'
            when 'soccer'       then p.game = 'Soccer'
            when 'tcg'          then p.game is not null and p.game not in ('Pokémon','Football','Basketball','Baseball','Soccer') and p.product_type <> 'accessory'
            when 'sealed'       then p.product_type = 'sealed'
            when 'accessories'  then p.product_type = 'accessory'
            when 'bulk'         then p.product_type = 'bulk'
            when 'collectibles' then p.product_type = 'collectible'
            else true end)
      and (p_game is null or p.game = p_game)
      and (p_type is null or p.product_type = p_type)
      and (p_condition is null or p.condition = p_condition)
      and (p_rarity is null or p.rarity = p_rarity)
      and (not p_in_stock or p.available_quantity > 0)
      and (not p_rookie or p.rookie)
  )
  select
    (to_jsonb(b) - 'cost' - 'notes' - 'search_text' - 'created_by' - 'square_catalog_id' - 'quantity' - 'reserved_quantity' - 'location_id') as product,
    count(*) over () as total
  from base b
  where (p_min is null or b.eff_price >= p_min)
    and (p_max is null or b.eff_price <= p_max)
  order by
    case when p_sort = 'price_asc'  then b.eff_price end asc nulls last,
    case when p_sort = 'price_desc' then b.eff_price end desc nulls last,
    case when p_sort = 'new'        then b.created_at end desc nulls last,
    case when p_sort = 'name'       then b.name end asc,
    case when p_sort = 'relevance' and coalesce(q,'') <> ''
         then (lower(extensions.unaccent(b.name)) like lower(extensions.unaccent(trim(q))) || '%')::int end desc nulls last,
    case when p_sort = 'relevance' then b.available_quantity > 0 end desc,
    b.name asc
  limit least(greatest(coalesce(p_limit, 48), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- Facet values for the filter dropdowns.
create or replace function public.product_facets()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'games',    coalesce((select jsonb_agg(distinct game order by game) from products where status='active' and game is not null), '[]'),
    'rarities', coalesce((select jsonb_agg(distinct rarity order by rarity) from products where status='active' and rarity is not null and rarity <> ''), '[]'),
    'counts',   (select jsonb_build_object(
                   'pokemon', count(*) filter (where game = 'Pokémon'),
                   'football', count(*) filter (where game = 'Football'),
                   'basketball', count(*) filter (where game = 'Basketball'),
                   'baseball', count(*) filter (where game = 'Baseball'),
                   'sports', count(*) filter (where game in ('Football','Basketball','Baseball','Soccer') or product_type = 'sports'),
                   'tcg', count(*) filter (where game is not null and game not in ('Pokémon','Football','Basketball','Baseball','Soccer') and product_type <> 'accessory'),
                   'sealed', count(*) filter (where product_type = 'sealed'),
                   'accessories', count(*) filter (where product_type = 'accessory'),
                   'bulk', count(*) filter (where product_type = 'bulk'))
                 from products where status = 'active')
  )
$$;

-- ─────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────
alter table public.profiles             enable row level security;
alter table public.inventory_locations  enable row level security;
alter table public.products             enable row level security;
alter table public.product_images       enable row level security;
alter table public.store_settings       enable row level security;
alter table public.events               enable row level security;
alter table public.rewards_members      enable row level security;
alter table public.rewards_transactions enable row level security;
alter table public.audit_logs           enable row level security;

-- profiles: you see your own; staff see everyone; owner manages roles (trigger enforces it).
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (id = auth.uid() or public.is_owner()) with check (id = auth.uid() or public.is_owner());

-- locations: anyone reads; admins write.
drop policy if exists loc_read on public.inventory_locations;
create policy loc_read on public.inventory_locations for select using (true);
drop policy if exists loc_write on public.inventory_locations;
create policy loc_write on public.inventory_locations for all using (public.is_admin()) with check (public.is_admin());

-- products: shoppers read active products; staff read everything and edit; admins create and delete.
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (status = 'active' or public.is_staff());
drop policy if exists products_staff_update on public.products;
create policy products_staff_update on public.products for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert on public.products for insert with check (public.is_admin());
drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete on public.products for delete using (public.is_admin());

-- Column privileges: shoppers (anon and signed-in customers) can only read public columns.
-- Cost, internal notes and raw stock counts are reachable only through the staff functions below.
revoke select on public.products from anon, authenticated;
grant select (id, sku, slug, name, product_type, game, set_name, card_number, rarity, card_type, player, team, year,
              manufacturer, rookie, parallel, is_insert, holo, language, condition, price, sale_price, compare_at_price,
              available_quantity, description, tags, status, featured, is_demo, created_at, updated_at)
  on public.products to anon, authenticated;

-- Staff product list with search, filters and paging (full rows, including cost).
create or replace function public.admin_search_products(
  q text default '', p_status text default 'active', p_type text default null,
  p_low integer default null, p_limit integer default 50, p_offset integer default 0)
returns table (product jsonb, total bigint)
language sql stable security definer set search_path = public, extensions as $$
  with toks as (select array_remove(regexp_split_to_array(lower(extensions.unaccent(trim(coalesce(q,'')))), '\s+'), '') t)
  select to_jsonb(p) - 'search_text'
         || jsonb_build_object('image_path', (select i.path from product_images i where i.product_id = p.id order by i.position, i.created_at limit 1)),
         count(*) over ()
  from products p, toks
  where public.is_staff()
    and (p_status = 'all' or p.status = p_status)
    and (p_type is null or p.product_type = p_type)
    and (p_low is null or p.available_quantity <= p_low)
    and (cardinality(toks.t) = 0 or not exists (select 1 from unnest(toks.t) w where p.search_text not like '%' || w || '%'))
  order by p.updated_at desc
  limit least(greatest(coalesce(p_limit,50),1),500) offset greatest(coalesce(p_offset,0),0)
$$;

create or replace function public.admin_get_product(p_id uuid)
returns public.products language sql stable security definer set search_path = public, extensions as $$
  select * from public.products where id = p_id and public.is_staff()
$$;

create or replace function public.admin_export_products()
returns setof public.products language sql stable security definer set search_path = public, extensions as $$
  select * from public.products where public.is_staff() order by created_at
$$;

create or replace function public.admin_stats()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select case when public.is_staff() then jsonb_build_object(
    'active',   (select count(*) from products where status = 'active'),
    'archived', (select count(*) from products where status = 'archived'),
    'units',    (select coalesce(sum(quantity),0) from products where status = 'active'),
    'retail',   (select coalesce(sum(quantity * coalesce(sale_price, price)),0) from products where status = 'active'),
    'cost',     (select coalesce(sum(quantity * cost),0) from products where status = 'active'),
    'members',  (select count(*) from rewards_members),
    'points',   (select coalesce(sum(points),0) from rewards_members)
  ) end
$$;

-- product images: anyone reads images of active products; staff manage.
drop policy if exists images_read on public.product_images;
create policy images_read on public.product_images for select using (
  public.is_staff() or exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
drop policy if exists images_write on public.product_images;
create policy images_write on public.product_images for all using (public.is_staff()) with check (public.is_staff());

-- settings: anyone reads (contains no secrets); admins write.
drop policy if exists settings_read on public.store_settings;
create policy settings_read on public.store_settings for select using (true);
drop policy if exists settings_write on public.store_settings;
create policy settings_write on public.store_settings for update using (public.is_admin()) with check (public.is_admin());

-- events: anyone reads active; staff manage.
drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (status = 'active' or public.is_staff());
drop policy if exists events_write on public.events;
create policy events_write on public.events for all using (public.is_staff()) with check (public.is_staff());

-- rewards: staff only (customer contact details). Members will see their own balance once accounts launch.
drop policy if exists rm_staff on public.rewards_members;
create policy rm_staff on public.rewards_members for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists rm_self on public.rewards_members;
create policy rm_self on public.rewards_members for select using (user_id = auth.uid());
drop policy if exists rt_staff on public.rewards_transactions;
create policy rt_staff on public.rewards_transactions for select using (public.is_staff());
drop policy if exists rt_self on public.rewards_transactions;
create policy rt_self on public.rewards_transactions for select using (
  exists (select 1 from public.rewards_members m where m.id = member_id and m.user_id = auth.uid()));

-- audit: admins read; staff can add entries (the trigger writes most of them).
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select using (public.is_admin());
drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert with check (public.is_staff() and actor_id = auth.uid());

create or replace function public.admin_adjust_prices(p_ids uuid[], p_pct numeric)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  update public.products set price = greatest(round(price * (1 + p_pct / 100.0), 2), 0) where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.search_products to anon, authenticated;
grant execute on function public.admin_adjust_prices to authenticated;
grant execute on function public.product_facets to anon, authenticated;
grant execute on function public.rewards_apply to authenticated;
grant execute on function public.admin_search_products, public.admin_get_product, public.admin_export_products, public.admin_stats to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Storage bucket for product photos
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "product images staff insert" on storage.objects;
create policy "product images staff insert" on storage.objects for insert with check (bucket_id = 'product-images' and public.is_staff());
drop policy if exists "product images staff update" on storage.objects;
create policy "product images staff update" on storage.objects for update using (bucket_id = 'product-images' and public.is_staff());
drop policy if exists "product images staff delete" on storage.objects;
create policy "product images staff delete" on storage.objects for delete using (bucket_id = 'product-images' and public.is_staff());
