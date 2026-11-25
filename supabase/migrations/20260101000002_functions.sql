-- Helper functions, triggers, and transactional business logic

-- ===== Role helpers (SECURITY DEFINER to avoid RLS recursion) =====
create or replace function public.current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid() and is_active), false)
$$;

create or replace function public.my_vendor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select v.id from vendors v
  join profiles p on p.id = v.barista_id
  where v.barista_id = auth.uid() and p.is_active and p.role = 'barista'
$$;

-- ===== New user bootstrap: ALWAYS a customer; roles are granted only by admins =====
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name, phone)
  values (new.id, 'customer',
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          new.raw_user_meta_data->>'phone');
  insert into customers (profile_id) values (new.id);
  insert into loyalty_accounts (customer_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ===== Prevent privilege escalation on profiles =====
create or replace function public.protect_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
      raise exception 'role and is_active can only be changed by an administrator';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_protect before update on profiles
  for each row execute function public.protect_profile_columns();

-- ===== Vendor status change log + guard: barista can only change status =====
create or replace function public.log_vendor_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into vendor_status_history (vendor_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end $$;

create trigger vendors_status_log after insert or update on vendors
  for each row execute function public.log_vendor_status();

create or replace function public.protect_vendor_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.barista_id is distinct from old.barista_id or new.code is distinct from old.code
       or new.name is distinct from old.name or new.is_active is distinct from old.is_active then
      raise exception 'baristas may only change operational status';
    end if;
  end if;
  return new;
end $$;

create trigger vendors_protect before update on vendors
  for each row execute function public.protect_vendor_columns();

-- ===== Location writes: only while vendor is ACTIVE/BUSY, with accuracy validation =====
create or replace function public.validate_vendor_location() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status vendor_status;
begin
  select status into v_status from vendors where id = new.vendor_id;
  if v_status not in ('ACTIVE','BUSY') then
    raise exception 'vendor is not operational; location update rejected';
  end if;
  new.updated_at = now();
  return new;
end $$;

create trigger vendor_locations_validate before insert or update on vendor_locations
  for each row execute function public.validate_vendor_location();

-- Clear stale data when vendor goes offline/paused
create or replace function public.clear_location_on_offline() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('OFFLINE','PAUSED') and old.status is distinct from new.status then
    delete from vendor_locations where vendor_id = new.id;
  end if;
  return new;
end $$;

create trigger vendors_clear_location after update on vendors
  for each row execute function public.clear_location_on_offline();

-- ===== Cleanup of old location rows (called by Vercel Cron route, service role) =====
create or replace function public.cleanup_stale_locations(max_age interval default interval '15 minutes')
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from vendor_locations where updated_at < now() - max_age;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.cleanup_stale_locations(interval) from public, anon, authenticated;

-- ===== Atomic stock movement (stock-in / stock-out / adjustment). Never negative. =====
create or replace function public.apply_stock_movement(
  p_vendor_id uuid, p_ingredient_id uuid, p_type movement_type, p_quantity numeric, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_inv inventories%rowtype; v_delta numeric;
begin
  if not (public.is_admin() or public.my_vendor_id() = p_vendor_id) then
    raise exception 'not authorized';
  end if;
  if p_quantity = 0 then raise exception 'quantity must not be zero'; end if;

  v_delta := case p_type
    when 'STOCK_IN' then abs(p_quantity)
    when 'STOCK_OUT' then -abs(p_quantity)
    when 'ADJUSTMENT' then p_quantity
    else null end;
  if v_delta is null then raise exception 'unsupported movement type'; end if;

  insert into inventories (vendor_id, ingredient_id, quantity) values (p_vendor_id, p_ingredient_id, 0)
  on conflict (vendor_id, ingredient_id) do nothing;

  select * into v_inv from inventories
   where vendor_id = p_vendor_id and ingredient_id = p_ingredient_id for update;

  if v_inv.quantity + v_delta < 0 then raise exception 'insufficient stock'; end if;

  update inventories set quantity = quantity + v_delta where id = v_inv.id;
  insert into inventory_movements (inventory_id, type, quantity, note, created_by)
  values (v_inv.id, p_type, v_delta, p_note, auth.uid());
end $$;

-- ===== Complete order: status change + recipe-based inventory deduction in ONE transaction =====
create or replace function public.complete_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; r record; v_inv inventories%rowtype; v_need numeric; v_points int;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if not (public.is_admin() or public.my_vendor_id() = v_order.vendor_id) then
    raise exception 'not authorized';
  end if;
  if v_order.status <> 'READY_FOR_PICKUP' then raise exception 'order is not ready for pickup'; end if;
  if v_order.inventory_deducted then raise exception 'inventory already deducted'; end if;

  for r in
    select pr.ingredient_id, sum(pr.quantity * oi.quantity) as need
      from order_items oi join product_recipes pr on pr.product_id = oi.product_id
     where oi.order_id = p_order_id
     group by pr.ingredient_id
  loop
    v_need := r.need;
    select * into v_inv from inventories
     where vendor_id = v_order.vendor_id and ingredient_id = r.ingredient_id for update;
    if not found or v_inv.quantity < v_need then
      raise exception 'insufficient stock for ingredient %', r.ingredient_id;
    end if;
    update inventories set quantity = quantity - v_need where id = v_inv.id;
    insert into inventory_movements (inventory_id, type, quantity, order_id, note, created_by)
    values (v_inv.id, 'ORDER_DEDUCTION', -v_need, p_order_id, 'Order ' || v_order.order_number, auth.uid());
  end loop;

  update orders set status = 'COMPLETED', inventory_deducted = true where id = p_order_id;

  -- loyalty: 1 point per IDR 10,000
  v_points := floor(v_order.total / 10000);
  if v_points > 0 then
    update loyalty_accounts set points_balance = points_balance + v_points,
           lifetime_points = lifetime_points + v_points where customer_id = v_order.customer_id;
    insert into loyalty_transactions (customer_id, points, reason, order_id)
    values (v_order.customer_id, v_points, 'Order ' || v_order.order_number, p_order_id);
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id)
  values (auth.uid(), 'order.completed', 'orders', p_order_id::text);
end $$;
