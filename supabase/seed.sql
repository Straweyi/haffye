-- Optional demo seed. Run after migrations.
insert into product_categories (name, slug, sort_order) values
  ('Coffee','coffee',1), ('Non-Coffee','non-coffee',2), ('Snacks','snacks',3)
on conflict do nothing;

insert into ingredients (name, unit, low_stock_threshold) values
  ('Coffee Beans','g',500), ('Fresh Milk','ml',2000), ('Sugar Syrup','ml',500),
  ('Cups','pcs',50), ('Ice','g',2000)
on conflict do nothing;

-- Promote users AFTER they register (replace the emails):
-- update profiles set role='admin'   where id = (select id from auth.users where email='admin@haffye.test');
-- update profiles set role='barista' where id = (select id from auth.users where email='barista1@haffye.test');
-- insert into vendors (code,name,barista_id) values
--   ('HAF-001','HAFFYE Cart 01',(select id from auth.users where email='barista1@haffye.test'));
