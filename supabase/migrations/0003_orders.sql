-- Frontier TCG — update 3: online orders, payments and shipping.
-- Run once in Supabase: SQL Editor → New query → paste everything → Run. Safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- Orders
-- ─────────────────────────────────────────────────────────────
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  number           bigint not null unique default nextval('public.order_number_seq'),
  access_token     uuid not null default gen_random_uuid(),     -- lets a guest open their own confirmation page
  user_id          uuid references auth.users(id) on delete set null,
  email            text not null,
  full_name        text not null,
  phone            text,
  fulfillment      text not null check (fulfillment in ('ship','envelope','pickup')),
  ship_line1       text, ship_line2 text, ship_city text, ship_state text, ship_zip text,
  subtotal         numeric(10,2) not null,
  shipping         numeric(10,2) not null default 0,
  pickup_fee       numeric(10,2) not null default 0,
  tax              numeric(10,2) not null default 0,
  tax_rate         numeric(6,4) not null default 0,
  total            numeric(10,2) not null,
  status           text not null default 'pending' check (status in
                     ('pending','payment_failed','paid','processing','ready_for_pickup','shipped','delivered','completed','cancelled','refunded')),
  payment_id       text,
  receipt_url      text,
  card_brand       text,
  card_last4       text,
  carrier          text,
  tracking_number  text,
  shipped_at       timestamptz,
  customer_note    text,
  internal_note    text,
  refunded_amount  numeric(10,2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  paid_at          timestamptz
);
create index if not exists orders_status on public.orders (status, created_at desc);
create index if not exists orders_user on public.orders (user_id, created_at desc);
create index if not exists orders_email on public.orders (lower(email));

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  sku         text,
  name        text not null,
  details     text,             -- set · number · condition, captured at purchase
  image_path  text,
  image_url   text,
  unit_price  numeric(10,2) not null,
  quantity    integer not null check (quantity > 0),
  line_total  numeric(10,2) not null
);
create index if not exists order_items_order on public.order_items (order_id);

create table if not exists public.order_events (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders(id) on delete cascade,
  status     text,
  note       text,
  actor_id   uuid references auth.users(id) on delete set null,
  actor_email text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order on public.order_events (order_id, created_at);

alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.order_events enable row level security;

-- Customers see their own orders; staff see everything. Nobody writes directly: orders change only through the functions below.
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));
drop policy if exists order_events_read on public.order_events;
create policy order_events_read on public.order_events for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));
revoke insert, update, delete on public.orders, public.order_items, public.order_events from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Checkout functions (called only by the website's server, never by a browser)
-- ─────────────────────────────────────────────────────────────

-- Free stock held by checkouts that never finished (closed tab, crash) after 20 minutes.
create or replace function public.release_stale_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare o record; n integer := 0;
begin
  for o in select id from public.orders where status = 'pending' and created_at < now() - interval '20 minutes' for update skip locked loop
    perform public.release_order(o.id, 'Checkout was not completed');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Create a pending order. Prices come from the database, never from the browser. Stock is held so it can't be oversold.
create or replace function public.create_order(p_user uuid, p_email text, p_name text, p_phone text, p_fulfillment text,
  p_address jsonb, p_items jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s jsonb; it jsonb; p public.products; qty integer; v_price numeric; v_sub numeric := 0; v_ship numeric := 0; v_fee numeric := 0;
  v_rate numeric := 0; v_tax numeric := 0; o public.orders; img text; v_state text; free_over numeric;
begin
  perform public.release_stale_orders();
  select data into s from public.store_settings where id = 1;
  if coalesce(s->>'siteMode', 'live') = 'maintenance' then raise exception 'The store is closed for maintenance. Please try again soon.'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'Your cart is empty.'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'Too many different items in one order.'; end if;

  if p_fulfillment = 'pickup' and not coalesce((s->>'pickupEnabled')::boolean, false) then raise exception 'Local pickup isn''t available right now.'; end if;
  if p_fulfillment = 'ship' and not coalesce((s->>'shippingEnabled')::boolean, true) then raise exception 'Shipping isn''t available right now.'; end if;
  if p_fulfillment = 'envelope' and not coalesce((s->>'envelopeEnabled')::boolean, false) then raise exception 'Envelope shipping isn''t available right now.'; end if;
  if p_fulfillment in ('ship','envelope') and (coalesce(p_address->>'line1','') = '' or coalesce(p_address->>'city','') = ''
      or coalesce(p_address->>'state','') = '' or coalesce(p_address->>'zip','') = '') then
    raise exception 'Please enter your full shipping address.';
  end if;

  insert into public.orders (user_id, email, full_name, phone, fulfillment, ship_line1, ship_line2, ship_city, ship_state, ship_zip,
                             subtotal, total, customer_note)
  values (p_user, lower(trim(p_email)), trim(p_name), nullif(trim(coalesce(p_phone,'')), ''), p_fulfillment,
          p_address->>'line1', nullif(p_address->>'line2',''), p_address->>'city', upper(p_address->>'state'), p_address->>'zip',
          0, 0, nullif(left(trim(coalesce(p_note,'')), 500), ''))
  returning * into o;

  -- Lock each product in a stable order so two checkouts can't deadlock or both take the last card.
  for it in select value from jsonb_array_elements(p_items) order by value->>'id' loop
    qty := (it->>'qty')::integer;
    if qty is null or qty < 1 or qty > 999 then raise exception 'Invalid quantity.'; end if;
    select * into p from public.products where id = (it->>'id')::uuid and status = 'active' for update;
    if not found then raise exception 'One of the items in your cart is no longer available. Please review your cart.'; end if;
    if p.quantity - p.reserved_quantity < qty then
      raise exception '% just sold out (only % left). Please update your cart.', p.name, greatest(p.quantity - p.reserved_quantity, 0);
    end if;
    v_price := case when p.sale_price is not null and p.sale_price < p.price then p.sale_price else p.price end;
    update public.products set reserved_quantity = reserved_quantity + qty where id = p.id;
    select i.path into img from public.product_images i where i.product_id = p.id order by i.position limit 1;
    insert into public.order_items (order_id, product_id, sku, name, details, image_path, image_url, unit_price, quantity, line_total)
    values (o.id, p.id, p.sku, p.name,
            concat_ws(' · ', p.set_name, case when p.card_number is not null then '#' || p.card_number end, p.condition),
            img, p.image_url, v_price, qty, round(v_price * qty, 2));
    v_sub := v_sub + round(v_price * qty, 2);
  end loop;

  -- Delivery
  if p_fulfillment = 'ship' then
    free_over := coalesce((s->>'freeShippingOver')::numeric, 0);
    v_ship := case when free_over > 0 and v_sub >= free_over then 0 else coalesce((s->>'shippingFlat')::numeric, 4.99) end;
  elsif p_fulfillment = 'envelope' then
    if v_sub > coalesce((s->>'envelopeMax')::numeric, 20) then raise exception 'Envelope shipping is only for orders up to $%. Please choose tracked shipping.', coalesce((s->>'envelopeMax')::numeric, 20); end if;
    if exists (select 1 from public.order_items oi join public.products pr on pr.id = oi.product_id
               where oi.order_id = o.id and pr.product_type not in ('single','bulk','sports')) then
      raise exception 'Envelope shipping is for single cards only. Please choose tracked shipping.';
    end if;
    v_ship := coalesce((s->>'envelopePrice')::numeric, 1.50);
  else
    v_fee := coalesce((s->>'pickupFee')::numeric, 2);
  end if;

  -- Sales tax: pickups and orders shipped to Texas.
  v_state := case when p_fulfillment = 'pickup' then 'TX' else upper(coalesce(p_address->>'state','')) end;
  if coalesce((s->>'taxEnabled')::boolean, true) and v_state in ('TX','TEXAS') then
    v_rate := coalesce((s->>'taxRate')::numeric, 8.25) / 100;
    v_tax := round((v_sub + case when coalesce((s->>'taxShipping')::boolean, true) then v_ship + v_fee else 0 end) * v_rate, 2);
  end if;

  update public.orders set subtotal = v_sub, shipping = v_ship, pickup_fee = v_fee, tax = v_tax, tax_rate = v_rate,
         total = v_sub + v_ship + v_fee + v_tax, updated_at = now()
  where id = o.id returning * into o;
  insert into public.order_events (order_id, status, note) values (o.id, 'pending', 'Checkout started');
  return jsonb_build_object('id', o.id, 'number', o.number, 'total', o.total, 'token', o.access_token);
end $$;

-- Payment went through: take the stock for real and mark the order paid.
create or replace function public.finalize_order(p_order uuid, p_payment_id text, p_receipt text, p_brand text, p_last4 text, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; it record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'pending' then return; end if;  -- already handled
  if p_amount is distinct from o.total then raise exception 'Payment amount does not match the order total'; end if;
  for it in select product_id, quantity from public.order_items where order_id = o.id and product_id is not null loop
    update public.products set quantity = greatest(quantity - it.quantity, 0),
           reserved_quantity = greatest(reserved_quantity - it.quantity, 0) where id = it.product_id;
  end loop;
  update public.orders set status = 'paid', payment_id = p_payment_id, receipt_url = p_receipt, card_brand = p_brand,
         card_last4 = p_last4, paid_at = now(), updated_at = now() where id = o.id;
  insert into public.order_events (order_id, status, note) values (o.id, 'paid', 'Payment received');
end $$;

-- Payment failed or checkout abandoned: give the held stock back.
create or replace function public.release_order(p_order uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; it record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.status <> 'pending' then return; end if;
  for it in select product_id, quantity from public.order_items where order_id = o.id and product_id is not null loop
    update public.products set reserved_quantity = greatest(reserved_quantity - it.quantity, 0) where id = it.product_id;
  end loop;
  update public.orders set status = 'payment_failed', updated_at = now() where id = o.id;
  insert into public.order_events (order_id, status, note) values (o.id, 'payment_failed', left(coalesce(p_reason, 'Payment failed'), 300));
end $$;

-- Staff: move an order along (processing → shipped → delivered, ready for pickup → completed, cancel).
create or replace function public.order_set_status(p_order uuid, p_status text, p_note text default null,
  p_carrier text default null, p_tracking text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders; who text;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_status not in ('processing','ready_for_pickup','shipped','delivered','completed','cancelled') then raise exception 'Unknown status'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status in ('pending','payment_failed') then raise exception 'This order was never paid'; end if;
  if o.status = 'refunded' then raise exception 'This order was refunded'; end if;
  if p_status = 'cancelled' and o.status <> 'cancelled' then raise exception 'Use Refund to cancel a paid order so the customer gets their money back'; end if;
  select email into who from auth.users where id = auth.uid();
  update public.orders set status = p_status, updated_at = now(),
         carrier = coalesce(nullif(trim(p_carrier), ''), carrier),
         tracking_number = coalesce(nullif(trim(p_tracking), ''), tracking_number),
         shipped_at = case when p_status = 'shipped' then coalesce(shipped_at, now()) else shipped_at end
  where id = p_order returning * into o;
  insert into public.order_events (order_id, status, note, actor_id, actor_email) values (p_order, p_status, nullif(trim(coalesce(p_note,'')), ''), auth.uid(), who);
  return o;
end $$;

-- Staff: private note on an order.
create or replace function public.order_add_note(p_order uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  select email into who from auth.users where id = auth.uid();
  insert into public.order_events (order_id, note, actor_id, actor_email) values (p_order, left(trim(p_note), 1000), auth.uid(), who);
end $$;

-- Refund recorded after Square confirms it. Optionally puts the items back in stock.
create or replace function public.order_mark_refunded(p_order uuid, p_amount numeric, p_restock boolean, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; it record; who text;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  select email into who from auth.users where id = p_actor;
  if p_restock then
    for it in select product_id, quantity from public.order_items where order_id = o.id and product_id is not null loop
      update public.products set quantity = quantity + it.quantity where id = it.product_id;
    end loop;
  end if;
  update public.orders set refunded_amount = refunded_amount + p_amount,
         status = case when refunded_amount + p_amount >= total then 'refunded' else status end, updated_at = now()
  where id = o.id;
  insert into public.order_events (order_id, status, note, actor_id, actor_email)
  values (o.id, case when o.refunded_amount + p_amount >= o.total then 'refunded' end,
          'Refunded $' || to_char(p_amount, 'FM999990.00') || case when p_restock then ', items put back in stock' else '' end, p_actor, who);
end $$;

-- Only the website's server (service role) can create, pay or refund orders. Staff can change status and add notes.
revoke execute on function public.create_order, public.finalize_order, public.release_order, public.release_stale_orders, public.order_mark_refunded from public, anon, authenticated;
grant execute on function public.create_order, public.finalize_order, public.release_order, public.release_stale_orders, public.order_mark_refunded to service_role;
grant execute on function public.order_set_status, public.order_add_note to authenticated;

-- Sales numbers for the admin dashboard.
create or replace function public.admin_sales()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_staff() then jsonb_build_object(
    'today',      (select coalesce(sum(total - refunded_amount),0) from orders where paid_at >= date_trunc('day', now() at time zone 'America/Chicago') at time zone 'America/Chicago'),
    'week',       (select coalesce(sum(total - refunded_amount),0) from orders where paid_at >= now() - interval '7 days'),
    'month',      (select coalesce(sum(total - refunded_amount),0) from orders where paid_at >= date_trunc('month', now() at time zone 'America/Chicago') at time zone 'America/Chicago'),
    'orders_today', (select count(*) from orders where paid_at >= date_trunc('day', now() at time zone 'America/Chicago') at time zone 'America/Chicago'),
    'to_ship',    (select count(*) from orders where status in ('paid','processing') and fulfillment in ('ship','envelope')),
    'to_pickup',  (select count(*) from orders where status in ('paid','processing','ready_for_pickup') and fulfillment = 'pickup')
  ) end
$$;
grant execute on function public.admin_sales to authenticated;

-- New checkout settings (existing values are kept).
update public.store_settings set data = jsonb_build_object(
  'taxEnabled', true, 'taxRate', 8.25, 'taxShipping', true,
  'envelopeEnabled', false, 'envelopePrice', 1.50, 'envelopeMax', 20,
  'orderEmail', ''
) || data where id = 1;
