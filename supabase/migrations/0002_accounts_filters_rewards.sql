-- Frontier TCG — update 2: customer accounts, category filters, sets, auto-bulk, rewards catalog.
-- Run once in Supabase: SQL Editor → New query → paste everything → Run. Safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. New product details
-- ─────────────────────────────────────────────────────────────
alter table public.products add column if not exists product_kind text;   -- sealed: booster_box, etb… / accessories: sleeves…
alter table public.products add column if not exists grader       text;   -- PSA, BGS, CGC, SGC…
alter table public.products add column if not exists grade        text;   -- 10, 9.5…
alter table public.products add column if not exists tcgplayer_id text;
alter table public.products add column if not exists image_url    text;   -- outside photo (e.g. from a TCGplayer export), used when no photo is uploaded
create index if not exists products_set_name on public.products (game, set_name) where status = 'active';
create index if not exists products_tcgplayer on public.products (tcgplayer_id);

-- Which category tab a product belongs to. Bulk only shows in Bulk (and Card Finder).
create or replace function public.in_category(p_game text, p_type text, p_cat text)
returns boolean language sql immutable as $$
  select case p_cat
    when 'pokemon'      then p_game = 'Pokémon' and p_type <> 'bulk'
    when 'sports'       then (p_game in ('Football','Basketball','Baseball','Hockey','Soccer') or p_type = 'sports') and p_type <> 'bulk'
    when 'football'     then p_game = 'Football' and p_type <> 'bulk'
    when 'basketball'   then p_game = 'Basketball' and p_type <> 'bulk'
    when 'baseball'     then p_game = 'Baseball' and p_type <> 'bulk'
    when 'hockey'       then p_game = 'Hockey' and p_type <> 'bulk'
    when 'soccer'       then p_game = 'Soccer' and p_type <> 'bulk'
    when 'tcg'          then p_game is not null and p_game not in ('Pokémon','Football','Basketball','Baseball','Hockey','Soccer')
                             and p_type not in ('accessory','bulk')
    when 'sealed'       then p_type = 'sealed'
    when 'accessories'  then p_type = 'accessory'
    when 'bulk'         then p_type = 'bulk'
    when 'collectibles' then p_type = 'collectible'
    else true end
$$;

-- Keep slug, search text and the automatic bulk rule up to date on every write.
create or replace function public.products_before_write()
returns trigger language plpgsql set search_path = public, extensions as $$
declare s jsonb; threshold numeric;
begin
  if new.slug is null or new.slug = '' then
    new.slug := left(public.slugify(new.name), 60) || '-' || left(public.slugify(new.sku), 30);
  end if;

  -- Auto-bulk: singles at or under the bulk price go to Bulk. Runs when a card is added or its price changes,
  -- so you can still move a card by hand and it stays put until its price changes.
  if new.product_type in ('single','bulk') and (tg_op = 'INSERT' or new.price is distinct from old.price or new.sale_price is distinct from old.sale_price) then
    select data into s from public.store_settings where id = 1;
    if coalesce((s->>'autoBulk')::boolean, true) then
      threshold := coalesce((s->>'bulkThreshold')::numeric, 0.99);
      new.product_type := case when coalesce(new.sale_price, new.price) <= threshold then 'bulk' else 'single' end;
    end if;
  end if;

  new.search_text := lower(extensions.unaccent(concat_ws(' ',
    new.name, new.sku, new.game, new.set_name, new.card_number,
    replace(coalesce(new.card_number,''), '/', ' '),
    new.rarity, new.card_type, new.player, new.team, new.year, new.manufacturer,
    new.parallel, new.condition, new.product_type, replace(coalesce(new.product_kind,''), '_', ' '),
    new.grader, case when new.grader is not null then coalesce(new.grader,'') || ' ' || coalesce(new.grade,'') end,
    case when new.grader is not null then 'graded slab' end,
    case when new.rookie then 'rookie rc' end,
    case when new.is_insert then 'insert' end,
    case when new.holo then 'holo foil' end,
    case when new.product_kind = 'etb' then 'elite trainer box' end,
    array_to_string(new.tags, ' '))));
  new.updated_at := now();
  return new;
end $$;

-- Public columns now include the new fields.
grant select (product_kind, grader, grade, tcgplayer_id, image_url) on public.products to anon, authenticated;

drop view if exists public.products_public;
create view public.products_public
with (security_invoker = true) as
  select p.id, p.sku, p.slug, p.name, p.product_type, p.game, p.set_name, p.card_number, p.rarity,
         p.card_type, p.player, p.team, p.year, p.manufacturer, p.rookie, p.parallel, p.is_insert,
         p.holo, p.language, p.condition, p.price, p.sale_price, p.compare_at_price,
         p.available_quantity, p.description, p.tags, p.featured, p.is_demo, p.created_at, p.updated_at,
         p.product_kind, p.grader, p.grade, p.image_url,
         (select i.path from public.product_images i where i.product_id = p.id order by i.position, i.created_at limit 1) as image_path
  from public.products p
  where p.status = 'active';
grant select on public.products_public to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Sets (every Pokémon set is loaded at the bottom of this file)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.sets (
  id           uuid primary key default gen_random_uuid(),
  game         text not null,
  name         text not null,
  code         text,
  series       text,
  release_date date,
  card_count   integer,
  created_at   timestamptz not null default now(),
  unique (game, name)
);
alter table public.sets enable row level security;
drop policy if exists sets_read on public.sets;
create policy sets_read on public.sets for select using (true);
drop policy if exists sets_write on public.sets;
create policy sets_write on public.sets for all using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. Search with category-specific filters
-- ─────────────────────────────────────────────────────────────
drop function if exists public.search_products(text, text, text, text, text, text, numeric, numeric, boolean, boolean, text, integer, integer);

create or replace function public.search_products(
  q            text    default '',
  p_category   text    default null,
  p_game       text    default null,
  p_type       text    default null,
  p_condition  text    default null,
  p_rarity     text    default null,
  p_set        text    default null,
  p_player     text    default null,
  p_team       text    default null,
  p_year       text    default null,
  p_brand      text    default null,
  p_kind       text    default null,
  p_min        numeric default null,
  p_max        numeric default null,
  p_in_stock   boolean default false,
  p_rookie     boolean default false,
  p_insert     boolean default false,
  p_graded     boolean default false,
  p_holo       boolean default false,
  p_sort       text    default 'relevance',
  p_limit      integer default 48,
  p_offset     integer default 0
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
      and (p_category is null or public.in_category(p.game, p.product_type, p_category))
      and (p_game is null or p.game = p_game)
      and (p_type is null or p.product_type = p_type)
      and (p_condition is null or p.condition = p_condition)
      and (p_rarity is null or p.rarity = p_rarity)
      and (p_set is null or p.set_name = p_set)
      and (p_player is null or lower(extensions.unaccent(p.player)) like '%' || lower(extensions.unaccent(p_player)) || '%')
      and (p_team is null or p.team = p_team)
      and (p_year is null or p.year = p_year)
      and (p_brand is null or p.manufacturer = p_brand)
      and (p_kind is null or p.product_kind = p_kind)
      and (not p_in_stock or p.available_quantity > 0)
      and (not p_rookie or p.rookie)
      and (not p_insert or p.is_insert or p.parallel is not null)
      and (not p_graded or p.grader is not null)
      and (not p_holo or p.holo)
  )
  select
    (to_jsonb(b) - 'cost' - 'notes' - 'search_text' - 'created_by' - 'square_catalog_id' - 'quantity' - 'reserved_quantity' - 'location_id' - 'tcgplayer_id') as product,
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
grant execute on function public.search_products to anon, authenticated;

-- Filter choices for one tab (and optionally one game), built from what's actually in stock.
create or replace function public.scope_facets(p_category text default null, p_game text default null)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  with s as (
    select * from public.products
    where status = 'active'
      and (p_category is null or public.in_category(game, product_type, p_category))
      and (p_game is null or game = p_game)
  )
  select jsonb_build_object(
    'games',     coalesce((select jsonb_agg(distinct game order by game) from s where game is not null), '[]'),
    'sets',      coalesce((select jsonb_agg(distinct set_name order by set_name) from s where coalesce(set_name,'') <> ''), '[]'),
    'rarities',  coalesce((select jsonb_agg(distinct rarity order by rarity) from s where coalesce(rarity,'') <> ''), '[]'),
    'teams',     coalesce((select jsonb_agg(distinct team order by team) from s where coalesce(team,'') <> ''), '[]'),
    'players',   coalesce((select jsonb_agg(distinct player order by player) from s where coalesce(player,'') <> ''), '[]'),
    'years',     coalesce((select jsonb_agg(distinct year order by year desc) from s where coalesce(year,'') <> ''), '[]'),
    'brands',    coalesce((select jsonb_agg(distinct manufacturer order by manufacturer) from s where coalesce(manufacturer,'') <> ''), '[]'),
    'kinds',     coalesce((select jsonb_agg(distinct product_kind order by product_kind) from s where coalesce(product_kind,'') <> ''), '[]'),
    'total',     (select count(*) from s)
  )
$$;
grant execute on function public.scope_facets to anon, authenticated;

-- Item counts for the homepage category tiles.
create or replace function public.product_facets()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'games',    coalesce((select jsonb_agg(distinct game order by game) from products where status='active' and game is not null), '[]'),
    'rarities', coalesce((select jsonb_agg(distinct rarity order by rarity) from products where status='active' and coalesce(rarity,'') <> ''), '[]'),
    'counts',   (select jsonb_object_agg(c, (select count(*) from products p where p.status = 'active' and public.in_category(p.game, p.product_type, c)))
                 from unnest(array['pokemon','sports','football','basketball','baseball','hockey','soccer','tcg','sealed','accessories','bulk']) c)
  )
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Customer accounts
-- ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists email_prefs jsonb not null default '{}'::jsonb;

-- Save the name and marketing choice from the sign-up form. Everyone starts as a customer.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, marketing_opt_in)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''),
          coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false))
  on conflict (id) do nothing;
  return new;
end $$;

-- Keep the profile email in step with the login email.
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function public.handle_user_email_change();

-- Customers may only edit their own name, phone and email choices — never their role or email.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, marketing_opt_in, email_prefs) on public.profiles to authenticated;

-- Owner changes roles here. The email is looked up in the login system, so nobody can impersonate someone by renaming their profile.
create or replace function public.admin_set_role(p_email text, p_role public.app_role)
returns text language plpgsql security definer set search_path = public as $$
declare target uuid; target_email text;
begin
  if not public.is_owner() then raise exception 'Only the store owner can change roles'; end if;
  select id, email into target, target_email from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if target is null then raise exception 'No account with that email yet'; end if;
  if target = auth.uid() and p_role <> 'owner' then raise exception 'You can''t remove your own owner role'; end if;
  update public.profiles set role = p_role where id = target;
  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_name, field, new_value)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), 'changed', 'team', target_email, 'role', p_role::text);
  return target_email;
end $$;
grant execute on function public.admin_set_role to authenticated;

-- Customer list for owners and admins.
create or replace function public.admin_customers(p_search text default '', p_limit integer default 100, p_offset integer default 0)
returns table (id uuid, email text, full_name text, phone text, role public.app_role, marketing_opt_in boolean,
               created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean, total bigint)
language sql stable security definer set search_path = public as $$
  select p.id, u.email::text, p.full_name, p.phone, p.role, p.marketing_opt_in, u.created_at, u.last_sign_in_at,
         u.email_confirmed_at is not null, count(*) over ()
  from public.profiles p join auth.users u on u.id = p.id
  where public.is_admin()
    and (coalesce(p_search,'') = '' or u.email ilike '%' || p_search || '%' or p.full_name ilike '%' || p_search || '%')
  order by u.created_at desc
  limit least(greatest(coalesce(p_limit,100),1),500) offset greatest(coalesce(p_offset,0),0)
$$;
grant execute on function public.admin_customers to authenticated;

create table if not exists public.favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.favorites enable row level security;
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  full_name  text not null,
  line1      text not null,
  line2      text,
  city       text not null,
  state      text not null,
  zip        text not null,
  phone      text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user on public.addresses (user_id);
alter table public.addresses enable row level security;
drop policy if exists addresses_own on public.addresses;
create policy addresses_own on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 5. Rewards catalog and issued rewards (staff only for now; customers see "coming soon")
-- ─────────────────────────────────────────────────────────────
create table if not exists public.rewards_catalog (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  kind          text not null check (kind in ('amount_off','percent_off','free_item')),
  value         numeric(10,2),            -- dollars for amount_off, percent for percent_off
  item          text,                     -- what they get for free_item, e.g. "Pitch Black sleeved booster pack"
  points_cost   integer not null default 0 check (points_cost >= 0),   -- 0 = staff can give it without points
  max_issued    integer check (max_issued is null or max_issued > 0),  -- null = unlimited
  issued_count  integer not null default 0,
  expires_days  integer check (expires_days is null or expires_days > 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.member_rewards (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.rewards_members(id) on delete cascade,
  reward_id    uuid not null references public.rewards_catalog(id) on delete restrict,
  code         text not null unique,
  status       text not null default 'available' check (status in ('available','redeemed','void')),
  points_spent integer not null default 0,
  note         text,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz,
  redeemed_at  timestamptz,
  issued_by    uuid references auth.users(id) on delete set null,
  redeemed_by  uuid references auth.users(id) on delete set null
);
create index if not exists member_rewards_member on public.member_rewards (member_id, issued_at desc);
create index if not exists member_rewards_reward on public.member_rewards (reward_id);

alter table public.rewards_catalog enable row level security;
alter table public.member_rewards  enable row level security;
drop policy if exists rc_staff_read on public.rewards_catalog;
create policy rc_staff_read on public.rewards_catalog for select using (public.is_staff());
drop policy if exists rc_admin_write on public.rewards_catalog;
create policy rc_admin_write on public.rewards_catalog for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists mr_staff_read on public.member_rewards;
create policy mr_staff_read on public.member_rewards for select using (public.is_staff());
drop policy if exists mr_self_read on public.member_rewards;
create policy mr_self_read on public.member_rewards for select using (
  exists (select 1 from public.rewards_members m where m.id = member_id and m.user_id = auth.uid()));
-- Issuing, redeeming and voiding go through the functions below so limits and points are always respected.

-- Allow the rewards ledger to record reward redemptions.
alter table public.rewards_transactions drop constraint if exists rewards_transactions_kind_check;
alter table public.rewards_transactions add constraint rewards_transactions_kind_check check (kind in ('purchase','redeem','adjust','reward'));

-- Give a reward to one or more members. Respects the limit, takes points if the reward costs points.
create or replace function public.rewards_issue(p_reward uuid, p_members uuid[], p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare r public.rewards_catalog; m uuid; left_n integer; issued integer := 0; pts integer;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  select * into r from public.rewards_catalog where id = p_reward for update;
  if not found then raise exception 'Reward not found'; end if;
  if not r.active then raise exception 'That reward is turned off'; end if;

  foreach m in array coalesce(p_members, '{}') loop
    if r.max_issued is not null and r.issued_count + issued >= r.max_issued then exit; end if;
    if r.points_cost > 0 then
      select points into pts from public.rewards_members where id = m for update;
      if pts is null then continue; end if;
      if pts < r.points_cost then
        if cardinality(p_members) = 1 then raise exception 'Not enough points for this reward'; end if;
        continue;
      end if;
      update public.rewards_members set points = points - r.points_cost, lifetime_redeemed = lifetime_redeemed + r.points_cost, updated_at = now() where id = m;
      insert into public.rewards_transactions (member_id, kind, amount, points, note, created_by)
      values (m, 'reward', null, -r.points_cost, r.name, auth.uid());
    elsif not exists (select 1 from public.rewards_members where id = m) then
      continue;
    end if;
    insert into public.member_rewards (member_id, reward_id, code, points_spent, note, expires_at, issued_by)
    values (m, r.id, 'FT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), r.points_cost, p_note,
            case when r.expires_days is not null then now() + make_interval(days => r.expires_days) end, auth.uid());
    issued := issued + 1;
  end loop;

  if r.max_issued is not null and issued = 0 and r.issued_count >= r.max_issued then
    raise exception 'All % of this reward have been given out', r.max_issued;
  end if;
  update public.rewards_catalog set issued_count = issued_count + issued, updated_at = now() where id = r.id;
  return issued;
end $$;

-- Mark a reward code as used at the register.
create or replace function public.rewards_redeem(p_code text)
returns public.member_rewards language plpgsql security definer set search_path = public as $$
declare x public.member_rewards;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  select * into x from public.member_rewards where code = upper(trim(p_code)) for update;
  if not found then raise exception 'No reward with that code'; end if;
  if x.status = 'redeemed' then raise exception 'That reward was already used on %', to_char(x.redeemed_at at time zone 'America/Chicago', 'Mon DD, YYYY'); end if;
  if x.status = 'void' then raise exception 'That reward was cancelled'; end if;
  if x.expires_at is not null and x.expires_at < now() then raise exception 'That reward expired on %', to_char(x.expires_at at time zone 'America/Chicago', 'Mon DD, YYYY'); end if;
  update public.member_rewards set status = 'redeemed', redeemed_at = now(), redeemed_by = auth.uid() where id = x.id returning * into x;
  return x;
end $$;

-- Cancel a reward. Points spent on it go back to the member.
create or replace function public.rewards_void(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare x public.member_rewards;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  select * into x from public.member_rewards where id = p_id for update;
  if not found or x.status <> 'available' then raise exception 'Only unused rewards can be cancelled'; end if;
  update public.member_rewards set status = 'void' where id = p_id;
  update public.rewards_catalog set issued_count = greatest(issued_count - 1, 0) where id = x.reward_id;
  if x.points_spent > 0 then
    update public.rewards_members set points = points + x.points_spent, lifetime_redeemed = greatest(lifetime_redeemed - x.points_spent, 0), updated_at = now() where id = x.member_id;
    insert into public.rewards_transactions (member_id, kind, amount, points, note, created_by)
    values (x.member_id, 'adjust', null, x.points_spent, 'Reward cancelled, points returned', auth.uid());
  end if;
end $$;

grant execute on function public.rewards_issue, public.rewards_redeem, public.rewards_void to authenticated;

-- The standard points reward, created once so the points program keeps working.
insert into public.rewards_catalog (name, description, kind, value, points_cost)
select '$5 off', 'Standard points reward', 'amount_off', 5, 100
where not exists (select 1 from public.rewards_catalog);

-- New settings defaults (existing values are kept).
update public.store_settings set data = jsonb_build_object(
  'siteMode', case when data->>'comingSoon' = 'false' then 'live' else 'coming_soon' end,
  'maintenanceMessage', 'We''re making some improvements and will be back shortly. Thanks for your patience.',
  'autoBulk', true, 'bulkThreshold', 0.99, 'rewardsLive', false
) || data where id = 1;

-- Apply the bulk rule to cards already in the store.
update public.products set product_type = 'bulk'
where product_type = 'single' and coalesce(sale_price, price) <= 0.99
  and coalesce((select (data->>'autoBulk')::boolean from public.store_settings where id = 1), true);

-- ─────────────────────────────────────────────────────────────
-- 6. Every English Pokémon TCG set
-- ─────────────────────────────────────────────────────────────
-- Every English Pokémon TCG set (source: PokemonTCG/pokemon-tcg-data, updated Oct 2026).
insert into public.sets (game, name, code, series, release_date, card_count) values
  ('Pokémon', 'Base', 'BS', 'Base', '1999-01-09', 102),
  ('Pokémon', 'Jungle', 'JU', 'Base', '1999-06-16', 64),
  ('Pokémon', 'Wizards Black Star Promos', 'PR', 'Base', '1999-07-01', 53),
  ('Pokémon', 'Fossil', 'FO', 'Base', '1999-10-10', 62),
  ('Pokémon', 'Base Set 2', 'B2', 'Base', '2000-02-24', 130),
  ('Pokémon', 'Team Rocket', 'TR', 'Base', '2000-04-24', 82),
  ('Pokémon', 'Gym Heroes', 'G1', 'Gym', '2000-08-14', 132),
  ('Pokémon', 'Gym Challenge', 'G2', 'Gym', '2000-10-16', 132),
  ('Pokémon', 'Neo Genesis', 'N1', 'Neo', '2000-12-16', 111),
  ('Pokémon', 'Neo Discovery', 'N2', 'Neo', '2001-06-01', 75),
  ('Pokémon', 'Southern Islands', 'SI1', 'Other', '2001-07-31', 18),
  ('Pokémon', 'Neo Revelation', 'N3', 'Neo', '2001-09-21', 64),
  ('Pokémon', 'Neo Destiny', 'N4', 'Neo', '2002-02-28', 105),
  ('Pokémon', 'Legendary Collection', 'LC', 'Other', '2002-05-24', 110),
  ('Pokémon', 'Expedition Base Set', 'EX', 'E-Card', '2002-09-15', 165),
  ('Pokémon', 'Best of Game', 'BP', 'Other', '2002-12-01', 9),
  ('Pokémon', 'Aquapolis', 'AQ', 'E-Card', '2003-01-15', 147),
  ('Pokémon', 'Skyridge', 'SK', 'E-Card', '2003-05-12', 144),
  ('Pokémon', 'Ruby & Sapphire', 'RS', 'EX', '2003-07-01', 109),
  ('Pokémon', 'Sandstorm', 'SS', 'EX', '2003-09-18', 100),
  ('Pokémon', 'Nintendo Black Star Promos', 'PR-NP', 'NP', '2003-10-01', 40),
  ('Pokémon', 'Dragon', 'DR', 'EX', '2003-11-24', 97),
  ('Pokémon', 'Team Magma vs Team Aqua', 'MA', 'EX', '2004-03-01', 95),
  ('Pokémon', 'Hidden Legends', 'HL', 'EX', '2004-06-01', 101),
  ('Pokémon', 'EX Trainer Kit Latias', 'TK1A', 'EX', '2004-06-01', 10),
  ('Pokémon', 'EX Trainer Kit Latios', 'TK1B', 'EX', '2004-06-01', 10),
  ('Pokémon', 'FireRed & LeafGreen', 'RG', 'EX', '2004-09-01', 112),
  ('Pokémon', 'POP Series 1', 'POP1', 'POP', '2004-09-01', 17),
  ('Pokémon', 'Team Rocket Returns', 'TRR', 'EX', '2004-11-01', 109),
  ('Pokémon', 'Deoxys', 'DX', 'EX', '2005-02-01', 107),
  ('Pokémon', 'Emerald', 'EM', 'EX', '2005-05-01', 106),
  ('Pokémon', 'Unseen Forces', 'UF', 'EX', '2005-08-01', 115),
  ('Pokémon', 'POP Series 2', 'POP2', 'POP', '2005-08-01', 17),
  ('Pokémon', 'Delta Species', 'DS', 'EX', '2005-10-31', 113),
  ('Pokémon', 'Legend Maker', 'LM', 'EX', '2006-02-01', 92),
  ('Pokémon', 'EX Trainer Kit 2 Plusle', 'TK2A', 'EX', '2006-03-01', 12),
  ('Pokémon', 'EX Trainer Kit 2 Minun', 'TK2B', 'EX', '2006-03-01', 12),
  ('Pokémon', 'POP Series 3', 'POP3', 'POP', '2006-04-01', 17),
  ('Pokémon', 'Holon Phantoms', 'HP', 'EX', '2006-05-01', 110),
  ('Pokémon', 'Crystal Guardians', 'CG', 'EX', '2006-08-01', 100),
  ('Pokémon', 'POP Series 4', 'POP4', 'POP', '2006-08-01', 17),
  ('Pokémon', 'Dragon Frontiers', 'DF', 'EX', '2006-11-01', 101),
  ('Pokémon', 'Power Keepers', 'PK', 'EX', '2007-02-02', 108),
  ('Pokémon', 'POP Series 5', 'POP5', 'POP', '2007-03-01', 17),
  ('Pokémon', 'Diamond & Pearl', 'DP', 'Diamond & Pearl', '2007-05-01', 130),
  ('Pokémon', 'DP Black Star Promos', 'PR-DPP', 'Diamond & Pearl', '2007-05-01', 56),
  ('Pokémon', 'Mysterious Treasures', 'MT', 'Diamond & Pearl', '2007-08-01', 123),
  ('Pokémon', 'POP Series 6', 'POP6', 'POP', '2007-09-01', 17),
  ('Pokémon', 'Secret Wonders', 'SW', 'Diamond & Pearl', '2007-11-01', 132),
  ('Pokémon', 'Great Encounters', 'GE', 'Diamond & Pearl', '2008-02-01', 106),
  ('Pokémon', 'POP Series 7', 'POP7', 'POP', '2008-03-01', 17),
  ('Pokémon', 'Majestic Dawn', 'MD', 'Diamond & Pearl', '2008-05-01', 100),
  ('Pokémon', 'Legends Awakened', 'LA', 'Diamond & Pearl', '2008-08-01', 146),
  ('Pokémon', 'POP Series 8', 'POP8', 'POP', '2008-09-01', 17),
  ('Pokémon', 'Stormfront', 'SF', 'Diamond & Pearl', '2008-11-01', 100),
  ('Pokémon', 'Platinum', 'PL', 'Platinum', '2009-02-11', 127),
  ('Pokémon', 'POP Series 9', 'POP9', 'POP', '2009-03-01', 17),
  ('Pokémon', 'Rising Rivals', 'RR', 'Platinum', '2009-05-16', 111),
  ('Pokémon', 'Supreme Victors', 'SV', 'Platinum', '2009-08-19', 147),
  ('Pokémon', 'Arceus', 'AR', 'Platinum', '2009-11-04', 99),
  ('Pokémon', 'Pokémon Rumble', 'RU1', 'Other', '2009-12-02', 16),
  ('Pokémon', 'HeartGold & SoulSilver', 'HS', 'HeartGold & SoulSilver', '2010-02-10', 123),
  ('Pokémon', 'HGSS Black Star Promos', 'PR-HS', 'HeartGold & SoulSilver', '2010-02-10', 25),
  ('Pokémon', 'HS—Unleashed', 'UL', 'HeartGold & SoulSilver', '2010-05-12', 95),
  ('Pokémon', 'HS—Undaunted', 'UD', 'HeartGold & SoulSilver', '2010-08-18', 90),
  ('Pokémon', 'HS—Triumphant', 'TM', 'HeartGold & SoulSilver', '2010-11-03', 102),
  ('Pokémon', 'Call of Legends', 'CL', 'HeartGold & SoulSilver', '2011-02-09', 95),
  ('Pokémon', 'BW Black Star Promos', 'PR-BLW', 'Black & White', '2011-03-01', 101),
  ('Pokémon', 'Black & White', 'BLW', 'Black & White', '2011-04-25', 114),
  ('Pokémon', 'McDonald''s Collection 2011', 'MCD11', 'Other', '2011-06-17', 12),
  ('Pokémon', 'Emerging Powers', 'EPO', 'Black & White', '2011-08-31', 98),
  ('Pokémon', 'Noble Victories', 'NVI', 'Black & White', '2011-11-16', 101),
  ('Pokémon', 'Next Destinies', 'NXD', 'Black & White', '2012-02-08', 99),
  ('Pokémon', 'Dark Explorers', 'DEX', 'Black & White', '2012-05-09', 108),
  ('Pokémon', 'McDonald''s Collection 2012', 'MCD12', 'Other', '2012-06-15', 12),
  ('Pokémon', 'Dragons Exalted', 'DRX', 'Black & White', '2012-08-15', 124),
  ('Pokémon', 'Dragon Vault', 'DRV', 'Black & White', '2012-10-05', 20),
  ('Pokémon', 'Boundaries Crossed', 'BCR', 'Black & White', '2012-11-07', 149),
  ('Pokémon', 'Plasma Storm', 'PLS', 'Black & White', '2013-02-06', 135),
  ('Pokémon', 'Plasma Freeze', 'PLF', 'Black & White', '2013-05-08', 116),
  ('Pokémon', 'Plasma Blast', 'PLB', 'Black & White', '2013-08-14', 101),
  ('Pokémon', 'XY Black Star Promos', 'PR-XY', 'XY', '2013-10-12', 211),
  ('Pokémon', 'Legendary Treasures', 'LTR', 'Black & White', '2013-11-06', 113),
  ('Pokémon', 'Kalos Starter Set', 'KSS', 'XY', '2013-11-08', 39),
  ('Pokémon', 'XY', 'XY', 'XY', '2014-02-05', 146),
  ('Pokémon', 'Flashfire', 'FLF', 'XY', '2014-05-07', 106),
  ('Pokémon', 'McDonald''s Collection 2014', 'MCD14', 'Other', '2014-05-23', 12),
  ('Pokémon', 'Furious Fists', 'FFI', 'XY', '2014-08-13', 111),
  ('Pokémon', 'Phantom Forces', 'PHF', 'XY', '2014-11-05', 119),
  ('Pokémon', 'Primal Clash', 'PRC', 'XY', '2015-02-04', 160),
  ('Pokémon', 'Double Crisis', 'DCR', 'XY', '2015-03-25', 34),
  ('Pokémon', 'Roaring Skies', 'ROS', 'XY', '2015-05-06', 108),
  ('Pokémon', 'Ancient Origins', 'AOR', 'XY', '2015-08-12', 98),
  ('Pokémon', 'BREAKthrough', 'BKT', 'XY', '2015-11-04', 162),
  ('Pokémon', 'McDonald''s Collection 2015', 'MCD15', 'Other', '2015-11-27', 12),
  ('Pokémon', 'BREAKpoint', 'BKP', 'XY', '2016-02-03', 122),
  ('Pokémon', 'Generations', 'GEN', 'XY', '2016-02-22', 83),
  ('Pokémon', 'Fates Collide', 'FCO', 'XY', '2016-05-02', 124),
  ('Pokémon', 'Steam Siege', 'STS', 'XY', '2016-08-03', 114),
  ('Pokémon', 'McDonald''s Collection 2016', 'MCD16', 'Other', '2016-08-19', 12),
  ('Pokémon', 'Evolutions', 'EVO', 'XY', '2016-11-02', 108),
  ('Pokémon', 'Sun & Moon', 'SUM', 'Sun & Moon', '2017-02-03', 149),
  ('Pokémon', 'SM Black Star Promos', 'PR-SM', 'Sun & Moon', '2017-02-03', 248),
  ('Pokémon', 'Guardians Rising', 'GRI', 'Sun & Moon', '2017-05-05', 145),
  ('Pokémon', 'Burning Shadows', 'BUS', 'Sun & Moon', '2017-08-05', 147),
  ('Pokémon', 'Shining Legends', 'SLG', 'Sun & Moon', '2017-10-06', 73),
  ('Pokémon', 'Crimson Invasion', 'CIN', 'Sun & Moon', '2017-11-03', 111),
  ('Pokémon', 'McDonald''s Collection 2017', 'MCD17', 'Other', '2017-11-07', 12),
  ('Pokémon', 'Ultra Prism', 'UPR', 'Sun & Moon', '2018-02-02', 156),
  ('Pokémon', 'Forbidden Light', 'FLI', 'Sun & Moon', '2018-05-04', 131),
  ('Pokémon', 'Celestial Storm', 'CES', 'Sun & Moon', '2018-08-03', 168),
  ('Pokémon', 'Dragon Majesty', 'DRM', 'Sun & Moon', '2018-09-07', 70),
  ('Pokémon', 'McDonald''s Collection 2018', 'MCD18', 'Other', '2018-10-16', 12),
  ('Pokémon', 'Lost Thunder', 'LOT', 'Sun & Moon', '2018-11-02', 214),
  ('Pokémon', 'Team Up', 'TEU', 'Sun & Moon', '2019-02-01', 181),
  ('Pokémon', 'Detective Pikachu', 'DET', 'Sun & Moon', '2019-04-05', 18),
  ('Pokémon', 'Unbroken Bonds', 'UNB', 'Sun & Moon', '2019-05-03', 214),
  ('Pokémon', 'Unified Minds', 'UNM', 'Sun & Moon', '2019-08-02', 236),
  ('Pokémon', 'Hidden Fates', 'HIF', 'Sun & Moon', '2019-08-23', 68),
  ('Pokémon', 'Hidden Fates Shiny Vault', 'HIF', 'Sun & Moon', '2019-08-23', 94),
  ('Pokémon', 'McDonald''s Collection 2019', 'MCD19', 'Other', '2019-10-15', 12),
  ('Pokémon', 'Cosmic Eclipse', 'CEC', 'Sun & Moon', '2019-11-01', 236),
  ('Pokémon', 'SWSH Black Star Promos', 'PR-SW', 'Sword & Shield', '2019-11-15', 307),
  ('Pokémon', 'Sword & Shield', 'SSH', 'Sword & Shield', '2020-02-07', 202),
  ('Pokémon', 'Rebel Clash', 'RCL', 'Sword & Shield', '2020-05-01', 192),
  ('Pokémon', 'Darkness Ablaze', 'DAA', 'Sword & Shield', '2020-08-14', 189),
  ('Pokémon', 'Pokémon Futsal Collection', 'FUT20', 'Other', '2020-09-11', 5),
  ('Pokémon', 'Champion''s Path', 'CPA', 'Sword & Shield', '2020-09-25', 73),
  ('Pokémon', 'Vivid Voltage', 'VIV', 'Sword & Shield', '2020-11-13', 185),
  ('Pokémon', 'McDonald''s Collection 2021', 'MCD21', 'Other', '2021-02-09', 25),
  ('Pokémon', 'Shining Fates', 'SHF', 'Sword & Shield', '2021-02-19', 72),
  ('Pokémon', 'Shining Fates Shiny Vault', 'SHF', 'Sword & Shield', '2021-02-19', 122),
  ('Pokémon', 'Battle Styles', 'BST', 'Sword & Shield', '2021-03-19', 163),
  ('Pokémon', 'Chilling Reign', 'CRE', 'Sword & Shield', '2021-06-18', 198),
  ('Pokémon', 'Evolving Skies', 'EVS', 'Sword & Shield', '2021-08-27', 203),
  ('Pokémon', 'Celebrations', 'CEL', 'Sword & Shield', '2021-10-08', 25),
  ('Pokémon', 'Celebrations: Classic Collection', 'CEL', 'Sword & Shield', '2021-10-08', 25),
  ('Pokémon', 'Fusion Strike', 'FST', 'Sword & Shield', '2021-11-12', 264),
  ('Pokémon', 'Brilliant Stars', 'BRS', 'Sword & Shield', '2022-02-25', 172),
  ('Pokémon', 'Brilliant Stars Trainer Gallery', 'BRS', 'Sword & Shield', '2022-02-25', 30),
  ('Pokémon', 'Astral Radiance', 'ASR', 'Sword & Shield', '2022-05-27', 189),
  ('Pokémon', 'Astral Radiance Trainer Gallery', 'ASR', 'Sword & Shield', '2022-05-27', 30),
  ('Pokémon', 'Pokémon GO', 'PGO', 'Sword & Shield', '2022-07-01', 78),
  ('Pokémon', 'McDonald''s Collection 2022', 'MCD22', 'Other', '2022-08-03', 15),
  ('Pokémon', 'Lost Origin', 'LOR', 'Sword & Shield', '2022-09-09', 196),
  ('Pokémon', 'Lost Origin Trainer Gallery', 'LOR', 'Sword & Shield', '2022-09-09', 30),
  ('Pokémon', 'Silver Tempest', 'SIT', 'Sword & Shield', '2022-11-11', 195),
  ('Pokémon', 'Silver Tempest Trainer Gallery', 'SIT', 'Sword & Shield', '2022-11-11', 30),
  ('Pokémon', 'Scarlet & Violet Black Star Promos', 'PR-SV', 'Scarlet & Violet', '2023-01-01', 102),
  ('Pokémon', 'Crown Zenith', 'CRZ', 'Sword & Shield', '2023-01-20', 159),
  ('Pokémon', 'Crown Zenith Galarian Gallery', 'CRZ', 'Sword & Shield', '2023-01-20', 70),
  ('Pokémon', 'Scarlet & Violet', 'SVI', 'Scarlet & Violet', '2023-03-31', 198),
  ('Pokémon', 'Scarlet & Violet Energies', 'SVE', 'Scarlet & Violet', '2023-03-31', 8),
  ('Pokémon', 'Paldea Evolved', 'PAL', 'Scarlet & Violet', '2023-06-09', 193),
  ('Pokémon', 'Obsidian Flames', 'OBF', 'Scarlet & Violet', '2023-08-11', 197),
  ('Pokémon', '151', 'MEW', 'Scarlet & Violet', '2023-09-22', 165),
  ('Pokémon', 'Paradox Rift', 'PAR', 'Scarlet & Violet', '2023-11-03', 182),
  ('Pokémon', 'Paldean Fates', 'PAF', 'Scarlet & Violet', '2024-01-26', 91),
  ('Pokémon', 'Temporal Forces', 'TEF', 'Scarlet & Violet', '2024-03-22', 162),
  ('Pokémon', 'Twilight Masquerade', 'TWM', 'Scarlet & Violet', '2024-05-24', 167),
  ('Pokémon', 'Shrouded Fable', 'SFA', 'Scarlet & Violet', '2024-08-02', 64),
  ('Pokémon', 'Stellar Crown', 'SCR', 'Scarlet & Violet', '2024-09-13', 142),
  ('Pokémon', 'Surging Sparks', 'SSP', 'Scarlet & Violet', '2024-11-08', 191),
  ('Pokémon', 'Prismatic Evolutions', 'PRE', 'Scarlet & Violet', '2025-01-17', 131),
  ('Pokémon', 'Journey Together', 'JTG', 'Scarlet & Violet', '2025-03-28', 159),
  ('Pokémon', 'Destined Rivals', 'DRI', 'Scarlet & Violet', '2025-05-30', 182),
  ('Pokémon', 'White Flare', 'WHT', 'Scarlet & Violet', '2025-07-18', 86),
  ('Pokémon', 'Black Bolt', 'BLK', 'Scarlet & Violet', '2025-07-18', 86),
  ('Pokémon', 'Mega Evolution', 'MEG', 'Mega Evolution', '2025-09-26', 132),
  ('Pokémon', 'Phantasmal Flames', 'PFL', 'Mega Evolution', '2025-11-14', 94),
  ('Pokémon', 'Ascended Heroes', 'ASC', 'Mega Evolution', '2026-01-30', 217),
  ('Pokémon', 'Perfect Order', 'POR', 'Mega Evolution', '2026-03-27', 88),
  ('Pokémon', 'Chaos Rising', 'CRI', 'Mega Evolution', '2026-05-22', 86),
  ('Pokémon', 'Pitch Black', 'PBL', 'Mega Evolution', '2026-07-17', 84),
  ('Pokémon', '30th Celebration', '30C', 'Mega Evolution', '2026-09-16', 128),
  ('Pokémon', '30th Celebration: Classic Collection', '30C', 'Mega Evolution', '2026-09-16', 30)
on conflict (game, name) do update set code = excluded.code, series = excluded.series, release_date = excluded.release_date, card_count = excluded.card_count;
