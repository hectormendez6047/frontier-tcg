-- Demo products for testing. Every row is marked is_demo = true and shows a "Demo" label in the store.
-- Remove them all later from Admin → Products (filter "Demo"), or run:
--   delete from public.products where is_demo;

insert into public.products
  (sku, name, product_type, game, set_name, card_number, rarity, holo, condition, price, cost, quantity, featured, is_demo, description, location_id)
values
  ('DEMO-PKM-PIKA-025','Pikachu','single','Pokémon','Example Set','025','Common',false,'Near Mint',0.50,null,12,true,true,'Modern Pikachu single. Demo product for testing the Card Finder.',(select id from public.inventory_locations where name='Online')),
  ('DEMO-PKM-CHAR-125','Charizard','single','Pokémon','Scarlet & Violet','125/198','Holo Rare',true,'Near Mint',8.00,4.50,2,true,true,null,(select id from public.inventory_locations where name='Display Case')),
  ('DEMO-PKM-ETB','Pokémon Elite Trainer Box','sealed','Pokémon',null,null,null,false,'Sealed',49.99,null,6,true,true,null,(select id from public.inventory_locations where name='Main Store')),
  ('DEMO-PKM-BUNDLE','Pokémon Booster Bundle','sealed','Pokémon',null,null,null,false,'Sealed',29.99,null,9,false,true,null,(select id from public.inventory_locations where name='Main Store')),
  ('DEMO-OP-BOX','One Piece Booster Box','sealed','One Piece',null,null,null,false,'Sealed',119.99,null,2,true,true,null,(select id from public.inventory_locations where name='Storage')),
  ('DEMO-ACC-SLEEVE','Standard Card Sleeves (100)','accessory',null,null,null,null,false,'New',7.99,null,24,false,true,null,(select id from public.inventory_locations where name='Main Store')),
  ('DEMO-ACC-TOPLD','Top Loaders (25)','accessory',null,null,null,null,false,'New',4.99,null,30,false,true,null,(select id from public.inventory_locations where name='Main Store')),
  ('DEMO-BULK-BULBA','Bulbasaur','bulk','Pokémon','Example Set','001','Common',false,'Near Mint',0.25,null,40,false,true,null,(select id from public.inventory_locations where name='Bulk')),
  ('DEMO-BULK-SQUIRT','Squirtle','bulk','Pokémon','Example Set','007','Common',false,'Lightly Played',0.25,null,28,false,true,null,(select id from public.inventory_locations where name='Bulk')),
  ('DEMO-BULK-EEVEE','Eevee (Reverse Holo)','bulk','Pokémon','Example Set','133','Common',true,'Near Mint',0.50,null,0,false,true,null,(select id from public.inventory_locations where name='Bulk'))
on conflict (sku) do nothing;

insert into public.products
  (sku, name, product_type, game, player, team, year, manufacturer, rookie, is_insert, condition, price, quantity, featured, is_demo, location_id)
values
  ('DEMO-NFL-MAHOMES','Patrick Mahomes','sports','Football','Patrick Mahomes','Kansas City Chiefs','2024','Panini',false,true,'Near Mint',14.99,1,true,true,(select id from public.inventory_locations where name='Display Case')),
  ('DEMO-NBA-DONCIC','Luka Dončić','sports','Basketball','Luka Dončić','Los Angeles Lakers','2024','Panini',false,true,'Near Mint',6.50,3,false,true,(select id from public.inventory_locations where name='Display Case')),
  ('DEMO-MLB-ROOKIE','Baseball Rookie (Demo Card)','sports','Baseball','Demo Player','Demo Team','2025','Topps',true,false,'Near Mint',3.50,5,false,true,(select id from public.inventory_locations where name='Display Case'))
on conflict (sku) do nothing;

insert into public.events (name, starts_on, start_time, description, entry_fee, capacity, registration)
select 'Pokémon League Night (example)', current_date + 7, '6:30 PM',
       'Example event. Edit or delete it in Admin → Events.', 0, 24, 'walkin'
where not exists (select 1 from public.events);
