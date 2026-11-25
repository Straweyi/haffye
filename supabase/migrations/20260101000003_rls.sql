-- Row Level Security. Default deny; policies below grant minimal access.
-- Server-only writes (order creation, payment webhooks) use the service role, which bypasses RLS.

do $$
declare t text;
begin
  foreach t in array array['profiles','customers','vendors','vendor_locations','vendor_status_history',
    'product_categories','products','product_variants','product_addons','vendor_products',
    'ingredients','product_recipes','inventories','inventory_movements','vouchers','customer_vouchers',
    'loyalty_accounts','loyalty_transactions','orders','order_items','payments','payment_events',
    'reviews','notifications','audit_logs']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ===== profiles =====
create policy profiles_select_own on profiles for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on profiles for select to authenticated using (public.is_admin());
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());   -- role/is_active guarded by trigger
create policy profiles_admin_all on profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- baristas can see names of customers who ordered from their vendor
create policy profiles_select_vendor_customers on profiles for select to authenticated using (
  exists (select 1 from orders o where o.customer_id = profiles.id and o.vendor_id = public.my_vendor_id())
);

-- ===== customers =====
create policy customers_own on customers for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy customers_admin on customers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===== vendors =====
create policy vendors_select_active on vendors for select to authenticated using (is_active);
create policy vendors_barista_update on vendors for update to authenticated
  using (barista_id = auth.uid()) with check (barista_id = auth.uid());
create policy vendors_admin on vendors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===== vendor_locations: visible only for operational vendors =====
create policy vendor_locations_select on vendor_locations for select to authenticated using (
  public.is_admin()
  or vendor_id = public.my_vendor_id()
  or exists (select 1 from vendors v where v.id = vendor_id and v.is_active and v.status in ('ACTIVE','BUSY'))
);
-- Writes happen through /api/vendor/location (server validated); RLS still restricts to own vendor.
create policy vendor_locations_barista_write on vendor_locations for insert to authenticated
  with check (vendor_id = public.my_vendor_id());
create policy vendor_locations_barista_update on vendor_locations for update to authenticated
  using (vendor_id = public.my_vendor_id()) with check (vendor_id = public.my_vendor_id());
create policy vendor_locations_admin on vendor_locations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===== vendor_status_history =====
create policy vsh_barista_select on vendor_status_history for select to authenticated
  using (vendor_id = public.my_vendor_id());
create policy vsh_admin on vendor_status_history for select to authenticated using (public.is_admin());

-- ===== catalog: readable by all signed-in users, writable by admin =====
create policy categories_read on product_categories for select to authenticated using (is_active or public.is_admin());
create policy categories_admin on product_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy products_read on products for select to authenticated using (true);
create policy products_admin on products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy variants_read on product_variants for select to authenticated using (true);
create policy variants_admin on product_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy addons_read on product_addons for select to authenticated using (true);
create policy addons_admin on product_addons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- vendor_products
create policy vp_read on vendor_products for select to authenticated using (true);
create policy vp_barista_write on vendor_products for all to authenticated
  using (vendor_id = public.my_vendor_id()) with check (vendor_id = public.my_vendor_id());
create policy vp_admin on vendor_products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===== inventory =====
create policy ingredients_read on ingredients for select to authenticated
  using (public.is_admin() or public.my_vendor_id() is not null);
create policy ingredients_admin on ingredients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy recipes_read on product_recipes for select to authenticated
  using (public.is_admin() or public.my_vendor_id() is not null);
create policy recipes_admin on product_recipes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- inventory quantity changes go through apply_stock_movement()/complete_order() only
create policy inventories_barista_select on inventories for select to authenticated
  using (vendor_id = public.my_vendor_id());
create policy inventories_admin_select on inventories for select to authenticated using (public.is_admin());
create policy movements_barista_select on inventory_movements for select to authenticated using (
  exists (select 1 from inventories i where i.id = inventory_id and i.vendor_id = public.my_vendor_id())
);
create policy movements_admin_select on inventory_movements for select to authenticated using (public.is_admin());

-- ===== vouchers / loyalty =====
create policy vouchers_read on vouchers for select to authenticated using (is_active or public.is_admin());
create policy vouchers_admin on vouchers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy cv_own on customer_vouchers for select to authenticated using (customer_id = auth.uid());
create policy cv_admin on customer_vouchers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy la_own on loyalty_accounts for select to authenticated using (customer_id = auth.uid());
create policy la_admin on loyalty_accounts for select to authenticated using (public.is_admin());
create policy lt_own on loyalty_transactions for select to authenticated using (customer_id = auth.uid());
create policy lt_admin on loyalty_transactions for select to authenticated using (public.is_admin());

-- ===== orders (insert via server only) =====
create policy orders_customer_select on orders for select to authenticated using (customer_id = auth.uid());
create policy orders_barista_select on orders for select to authenticated using (vendor_id = public.my_vendor_id());
create policy orders_admin_select on orders for select to authenticated using (public.is_admin());
-- Barista status transitions are enforced in a server action; RLS limits the rows they may touch.
create policy orders_barista_update on orders for update to authenticated
  using (vendor_id = public.my_vendor_id()) with check (vendor_id = public.my_vendor_id());

create policy oi_select on order_items for select to authenticated using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_id = auth.uid() or o.vendor_id = public.my_vendor_id() or public.is_admin()))
);

-- ===== payments (written only by server/webhook) =====
create policy payments_select on payments for select to authenticated using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_id = auth.uid() or o.vendor_id = public.my_vendor_id() or public.is_admin()))
);
create policy payment_events_admin on payment_events for select to authenticated using (public.is_admin());

-- ===== reviews =====
create policy reviews_read on reviews for select to authenticated using (true);
create policy reviews_insert_own on reviews for insert to authenticated with check (
  customer_id = auth.uid()
  and exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid() and o.status = 'COMPLETED')
);
create policy reviews_update_own on reviews for update to authenticated
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy reviews_admin on reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===== notifications =====
create policy notif_own_select on notifications for select to authenticated using (user_id = auth.uid());
create policy notif_own_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_admin on notifications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===== audit logs =====
create policy audit_admin_select on audit_logs for select to authenticated using (public.is_admin());

-- ===== Realtime publication =====
alter publication supabase_realtime add table vendors, vendor_locations, orders, notifications;
