-- HAFFYE schema (Phase 1)
create extension if not exists "pgcrypto";

-- ===== Enums =====
create type user_role as enum ('customer', 'barista', 'admin');
create type vendor_status as enum ('OFFLINE', 'ACTIVE', 'BUSY', 'PAUSED');
create type order_status as enum (
  'PENDING_PAYMENT','PAID','ACCEPTED','PREPARING','READY_FOR_PICKUP',
  'COMPLETED','REJECTED','CANCELLED','REFUNDED'
);
create type payment_status as enum ('PENDING','PAID','FAILED','EXPIRED','CANCELLED','REFUNDED');
create type movement_type as enum ('STOCK_IN','STOCK_OUT','ORDER_DEDUCTION','ADJUSTMENT');
create type voucher_type as enum ('PERCENT','FIXED');

-- ===== Helpers =====
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ===== Identity =====
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'customer',
  full_name text not null default '',
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  default_latitude double precision check (default_latitude between -90 and 90),
  default_longitude double precision check (default_longitude between -180 and 180),
  search_radius_km numeric(5,2) not null default 3 check (search_radius_km > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  barista_id uuid unique references profiles(id) on delete set null,
  status vendor_status not null default 'OFFLINE',
  vehicle_label text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vendors_status_idx on vendors(status) where is_active;

-- Latest known location only (one row per vendor)
create table vendor_locations (
  vendor_id uuid primary key references vendors(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision check (accuracy >= 0),
  heading double precision check (heading >= 0 and heading <= 360),
  speed double precision check (speed >= 0),
  updated_at timestamptz not null default now()
);
create index vendor_locations_updated_idx on vendor_locations(updated_at);

create table vendor_status_history (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  status vendor_status not null,
  changed_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index vendor_status_history_vendor_idx on vendor_status_history(vendor_id, created_at desc);

-- ===== Catalog =====
create table product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references product_categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  image_url text,
  base_price numeric(12,2) not null check (base_price >= 0),
  sweetness_options text[] not null default '{}',
  ice_options text[] not null default '{}',
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on products(category_id);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,                              -- e.g. Small / Regular / Large
  price_delta numeric(12,2) not null default 0,
  is_default boolean not null default false,
  is_available boolean not null default true,
  unique (product_id, name)
);

create table product_addons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0 check (price >= 0),
  is_available boolean not null default true,
  unique (product_id, name)
);

-- Per-vendor product availability (barista toggles)
create table vendor_products (
  vendor_id uuid not null references vendors(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  is_available boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (vendor_id, product_id)
);

-- ===== Inventory =====
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null,                              -- g, ml, pcs
  low_stock_threshold numeric(12,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_recipes (
  product_id uuid not null references products(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  primary key (product_id, ingredient_id)
);

create table inventories (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  quantity numeric(12,3) not null default 0 check (quantity >= 0),   -- prevents negative stock
  updated_at timestamptz not null default now(),
  unique (vendor_id, ingredient_id)
);

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventories(id) on delete cascade,
  type movement_type not null,
  quantity numeric(12,3) not null,                 -- signed: + in, - out
  order_id uuid,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_inv_idx on inventory_movements(inventory_id, created_at desc);

-- ===== Vouchers & loyalty =====
create table vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type voucher_type not null,
  value numeric(12,2) not null check (value > 0),
  min_order numeric(12,2) not null default 0,
  max_discount numeric(12,2),
  points_cost int not null default 0 check (points_cost >= 0),
  usage_limit int,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table customer_vouchers (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  voucher_id uuid not null references vouchers(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  used_at timestamptz,
  order_id uuid
);
create index customer_vouchers_customer_idx on customer_vouchers(customer_id);

create table loyalty_accounts (
  customer_id uuid primary key references profiles(id) on delete cascade,
  points_balance int not null default 0 check (points_balance >= 0),
  lifetime_points int not null default 0,
  updated_at timestamptz not null default now()
);

create table loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  points int not null,
  reason text not null,
  order_id uuid,
  created_at timestamptz not null default now()
);
create index loyalty_transactions_customer_idx on loyalty_transactions(customer_id, created_at desc);

-- ===== Orders & payments =====
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references profiles(id) on delete restrict,
  vendor_id uuid not null references vendors(id) on delete restrict,
  status order_status not null default 'PENDING_PAYMENT',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  customer_voucher_id uuid references customer_vouchers(id) on delete set null,
  note text,
  idempotency_key text not null,
  inventory_deducted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key)            -- duplicate submission protection
);
create index orders_vendor_status_idx on orders(vendor_id, status, created_at desc);
create index orders_customer_idx on orders(customer_id, created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,                      -- historical snapshot
  variant_name text,
  unit_price numeric(12,2) not null check (unit_price >= 0),  -- historical snapshot
  quantity int not null check (quantity > 0),
  sweetness text,
  ice text,
  addons jsonb not null default '[]',              -- [{name, price}]
  line_total numeric(12,2) not null check (line_total >= 0)
);
create index order_items_order_idx on order_items(order_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null default 'midtrans',
  provider_order_id text not null unique,
  status payment_status not null default 'PENDING',
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  payment_type text,
  snap_token text,
  redirect_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on payments(order_id);

-- Every webhook notification recorded once -> duplicate callback protection
create table payment_events (
  id uuid primary key default gen_random_uuid(),
  provider_order_id text not null,
  transaction_status text not null,
  status_code text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (provider_order_id, transaction_status, status_code)
);

-- ===== Engagement / ops =====
create table reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id, order_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on audit_logs(created_at desc);

-- ===== updated_at triggers =====
do $$
declare t text;
begin
  foreach t in array array['profiles','customers','vendors','product_categories','products',
    'ingredients','inventories','orders','payments','loyalty_accounts','vendor_products']
  loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;
