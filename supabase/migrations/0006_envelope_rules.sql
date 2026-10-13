-- Frontier TCG — update 6: safer envelope shipping.
-- Run once in Supabase: SQL Editor → New query → paste everything → Run. Safe to re-run.
-- Envelopes (no tracking) are limited to raw singles, orders of $20 or less, and a max number of cards (default 10).

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
    insert into public.order_items (order_id, product_id, sku, name, details, image_path, image_url, unit_price, quantity, line_total, bin)
    values (o.id, p.id, p.sku, p.name,
            concat_ws(' · ', p.set_name, case when p.card_number is not null then '#' || p.card_number end, p.condition),
            img, p.image_url, v_price, qty, round(v_price * qty, 2), p.bin);
    v_sub := v_sub + round(v_price * qty, 2);
  end loop;

  -- Delivery
  if p_fulfillment = 'ship' then
    free_over := coalesce((s->>'freeShippingOver')::numeric, 0);
    v_ship := case when free_over > 0 and v_sub >= free_over then 0 else coalesce((s->>'shippingFlat')::numeric, 4.99) end;
  elsif p_fulfillment = 'envelope' then
    if v_sub > least(coalesce((s->>'envelopeMax')::numeric, 20), 20) then raise exception 'Envelope shipping is only for card orders up to $%. Please choose tracked shipping.', least(coalesce((s->>'envelopeMax')::numeric, 20), 20); end if;
    if exists (select 1 from public.order_items oi join public.products pr on pr.id = oi.product_id
               where oi.order_id = o.id and (pr.product_type not in ('single','bulk','sports') or pr.grader is not null)) then
      raise exception 'Envelope shipping is for raw single cards only (no sealed, accessories or graded slabs). Please choose tracked shipping.';
    end if;
    if (select coalesce(sum(quantity), 0) from public.order_items where order_id = o.id) > coalesce((s->>'envelopeMaxCards')::integer, 10) then
      raise exception 'Envelopes fit up to % cards. Please choose tracked shipping so your cards arrive safely.', coalesce((s->>'envelopeMaxCards')::integer, 10);
    end if;
    v_ship := coalesce((s->>'envelopePrice')::numeric, 1.50);
  else
    -- Order prep fee, waived on bigger pickup orders.
    v_fee := case when coalesce((s->>'pickupFeeFreeOver')::numeric, 0) > 0 and v_sub >= (s->>'pickupFeeFreeOver')::numeric
                  then 0 else coalesce((s->>'pickupFee')::numeric, 1) end;
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

revoke execute on function public.create_order from public, anon, authenticated;
grant execute on function public.create_order to service_role;

-- Defaults: envelope cap $20 and 10 cards (existing values are kept, but the cap can't go above $20).
update public.store_settings set data = jsonb_build_object('envelopeMaxCards', 10) || data where id = 1;
update public.store_settings set data = data || '{"envelopeMax": 20}' where id = 1 and coalesce((data->>'envelopeMax')::numeric, 20) > 20;
