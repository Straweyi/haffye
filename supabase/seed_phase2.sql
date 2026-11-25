-- Idempotent Phase 2 seed: catalog products, variants, addons, recipes, and active sample carts

insert into product_categories (name, slug, sort_order) values
  ('Coffee', 'coffee', 1),
  ('Non-Coffee', 'non-coffee', 2),
  ('Snacks', 'snacks', 3)
on conflict (slug) do nothing;

insert into products (category_id, name, slug, description, image_url, base_price, sweetness_options, ice_options, is_available)
values
  (
    (select id from product_categories where slug = 'coffee'),
    'Haffye Aren Latte',
    'haffye-aren-latte',
    'Signature double-shot espresso shaken with caramelized palm sugar and velvety fresh milk.',
    'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80',
    24000,
    array['Normal', 'Less Sweet', 'Extra Sweet'],
    array['Normal Ice', 'Less Ice', 'No Ice'],
    true
  ),
  (
    (select id from product_categories where slug = 'coffee'),
    'Urban Americano',
    'urban-americano',
    'Crisp single-origin Arabica espresso pulled over cold filtered water for clean brightness.',
    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
    18000,
    array['No Sugar', 'Light Sweet', 'Normal'],
    array['Normal Ice', 'Less Ice', 'Hot'],
    true
  ),
  (
    (select id from product_categories where slug = 'coffee'),
    'Caramel Macchiato',
    'caramel-macchiato',
    'Steamed milk layered with bold espresso and house-made salted caramel drizzle.',
    'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=800&q=80',
    28000,
    array['Normal', 'Less Sweet'],
    array['Normal Ice', 'Less Ice', 'Hot'],
    true
  ),
  (
    (select id from product_categories where slug = 'coffee'),
    'Sea Salt Cold Brew',
    'sea-salt-cold-brew',
    '16-hour slow-steeped cold brew crowned with lightly salted vanilla cream foam.',
    'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80',
    27000,
    array['No Sugar', 'Normal', 'Less Sweet'],
    array['Normal Ice', 'Less Ice'],
    true
  ),
  (
    (select id from product_categories where slug = 'non-coffee'),
    'Uji Matcha Oat',
    'uji-matcha-oat',
    'Ceremonial-grade Japanese matcha whisked smooth over creamy milk.',
    'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=800&q=80',
    29000,
    array['Normal', 'Less Sweet', 'No Sugar'],
    array['Normal Ice', 'Less Ice', 'No Ice'],
    true
  ),
  (
    (select id from product_categories where slug = 'non-coffee'),
    'Dark Choco Signature',
    'dark-choco-signature',
    'Rich 70% dark cocoa blended silky with cold milk for a bold chocolate lift.',
    'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=800&q=80',
    26000,
    array['Normal', 'Less Sweet'],
    array['Normal Ice', 'Less Ice', 'Hot'],
    true
  ),
  (
    (select id from product_categories where slug = 'snacks'),
    'Butter Croissant',
    'butter-croissant',
    'Flaky, golden French-style laminated pastry baked fresh every morning.',
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80',
    22000,
    array[]::text[],
    array[]::text[],
    true
  ),
  (
    (select id from product_categories where slug = 'snacks'),
    'Choco Chip Muffin',
    'choco-chip-muffin',
    'Warm, tender vanilla crumb packed with dark chocolate chunks.',
    'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=800&q=80',
    20000,
    array[]::text[],
    array[]::text[],
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  base_price = excluded.base_price,
  sweetness_options = excluded.sweetness_options,
  ice_options = excluded.ice_options,
  is_available = excluded.is_available;

-- Variants for beverage products
insert into product_variants (product_id, name, price_delta, is_default, is_available)
select p.id, v.name, v.price_delta, v.is_default, true
from products p
join product_categories c on c.id = p.category_id
cross join (values ('Regular', 0, true), ('Large', 5000, false)) as v(name, price_delta, is_default)
where c.slug in ('coffee', 'non-coffee')
on conflict (product_id, name) do update set
  price_delta = excluded.price_delta,
  is_default = excluded.is_default;

-- Add-ons for beverage products
insert into product_addons (product_id, name, price, is_available)
select p.id, a.name, a.price, true
from products p
join product_categories c on c.id = p.category_id
cross join (
  values
    ('Extra Espresso Shot', 6000),
    ('Oat Milk Upgrade', 7000),
    ('Caramel Drizzle', 4000),
    ('Vanilla Syrup', 4000)
) as a(name, price)
where c.slug in ('coffee', 'non-coffee')
on conflict (product_id, name) do update set
  price = excluded.price;

-- Recipes for coffee items
insert into product_recipes (product_id, ingredient_id, quantity)
select p.id, i.id, r.qty
from (
  values
    ('haffye-aren-latte', 'Coffee Beans', 18),
    ('haffye-aren-latte', 'Fresh Milk', 150),
    ('haffye-aren-latte', 'Sugar Syrup', 25),
    ('haffye-aren-latte', 'Cups', 1),
    ('haffye-aren-latte', 'Ice', 120),
    ('urban-americano', 'Coffee Beans', 18),
    ('urban-americano', 'Cups', 1),
    ('urban-americano', 'Ice', 120),
    ('caramel-macchiato', 'Coffee Beans', 18),
    ('caramel-macchiato', 'Fresh Milk', 160),
    ('caramel-macchiato', 'Sugar Syrup', 20),
    ('caramel-macchiato', 'Cups', 1),
    ('sea-salt-cold-brew', 'Coffee Beans', 22),
    ('sea-salt-cold-brew', 'Fresh Milk', 40),
    ('sea-salt-cold-brew', 'Cups', 1),
    ('sea-salt-cold-brew', 'Ice', 140)
) as r(slug, ing_name, qty)
join products p on p.slug = r.slug
join ingredients i on i.name = r.ing_name
on conflict (product_id, ingredient_id) do update set quantity = excluded.quantity;

-- Set HAF-001 (ACTIVE) and HAF-002 (BUSY) with Jakarta coordinates for Phase 2 discovery & map testing
update vendors
set status = 'ACTIVE',
    vehicle_label = 'Electric Coffee Trike #01',
    description = 'Serving fresh espresso & cold brew around Sudirman.',
    is_active = true
where code = 'HAF-001';

update vendors
set status = 'BUSY',
    vehicle_label = 'Mobile Espresso Van #02',
    description = 'Parked near SCBD Walk with full signature menu.',
    is_active = true
where code = 'HAF-002';

insert into vendor_locations (vendor_id, latitude, longitude, accuracy, heading, speed)
select id, -6.2088, 106.8229, 10, 45, 0 from vendors where code = 'HAF-001'
on conflict (vendor_id) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  accuracy = excluded.accuracy,
  updated_at = now();

insert into vendor_locations (vendor_id, latitude, longitude, accuracy, heading, speed)
select id, -6.2246, 106.8097, 12, 120, 0 from vendors where code = 'HAF-002'
on conflict (vendor_id) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  accuracy = excluded.accuracy,
  updated_at = now();

-- Initial vendor inventories so orders in later phases have stock
insert into inventories (vendor_id, ingredient_id, quantity)
select v.id, i.id,
  case i.name
    when 'Coffee Beans' then 3000
    when 'Fresh Milk' then 10000
    when 'Sugar Syrup' then 3000
    when 'Cups' then 300
    when 'Ice' then 15000
    else 1000
  end
from vendors v
cross join ingredients i
where v.code in ('HAF-001', 'HAF-002')
on conflict (vendor_id, ingredient_id) do nothing;
