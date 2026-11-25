-- Idempotent Phase 3 seed: sample incoming & completed orders for HAF-002 (barista@haffye.com)
with cust as (
  select id from auth.users where email = 'customer@haffye.com' limit 1
),
vend as (
  select id from vendors where code = 'HAF-002' limit 1
),
p1 as (
  select id, name, base_price from products where slug = 'haffye-aren-latte' limit 1
),
p2 as (
  select id, name, base_price from products where slug = 'urban-americano' limit 1
),
ins_o1 as (
  insert into orders (
    order_number, customer_id, vendor_id, status, subtotal, discount, total, note, idempotency_key
  )
  select
    'HAF-DEMO-001', cust.id, vend.id, 'PAID', 47000, 0, 47000,
    'Less ice on the Aren Latte please', 'seed-phase3-demo-001'
  from cust, vend
  on conflict (order_number) do nothing
  returning id
),
o1 as (
  select id from ins_o1
  union all
  select id from orders where order_number = 'HAF-DEMO-001' limit 1
),
ins_oi1 as (
  insert into order_items (
    order_id, product_id, product_name, variant_name, unit_price, quantity, sweetness, ice, addons, line_total
  )
  select o1.id, p1.id, p1.name, 'Large', 29000, 1, 'Less Sweet', 'Less Ice', '[]'::jsonb, 29000
  from o1, p1
  where exists (select 1 from ins_o1)
  union all
  select o1.id, p2.id, p2.name, 'Regular', 18000, 1, 'No Sugar', 'Normal Ice', '[]'::jsonb, 18000
  from o1, p2
  where exists (select 1 from ins_o1)
),
ins_pay1 as (
  insert into payments (order_id, provider, provider_order_id, status, gross_amount, payment_type, paid_at)
  select o1.id, 'midtrans', 'MID-HAF-DEMO-001', 'PAID', 47000, 'qris', now()
  from o1
  on conflict (provider_order_id) do nothing
),
ins_o2 as (
  insert into orders (
    order_number, customer_id, vendor_id, status, subtotal, discount, total, note, idempotency_key, inventory_deducted
  )
  select
    'HAF-DEMO-002', cust.id, vend.id, 'COMPLETED', 24000, 0, 24000,
    null, 'seed-phase3-demo-002', true
  from cust, vend
  on conflict (order_number) do nothing
  returning id
),
o2 as (
  select id from ins_o2
  union all
  select id from orders where order_number = 'HAF-DEMO-002' limit 1
),
ins_oi2 as (
  insert into order_items (
    order_id, product_id, product_name, variant_name, unit_price, quantity, sweetness, ice, addons, line_total
  )
  select o2.id, p1.id, p1.name, 'Regular', 24000, 1, 'Normal', 'Normal Ice', '[]'::jsonb, 24000
  from o2, p1
  where exists (select 1 from ins_o2)
)
insert into payments (order_id, provider, provider_order_id, status, gross_amount, payment_type, paid_at)
select o2.id, 'midtrans', 'MID-HAF-DEMO-002', 'PAID', 24000, 'gopay', now()
from o2
on conflict (provider_order_id) do nothing;
