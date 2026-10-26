-- ITX Shop Supabase schema. Run in Supabase SQL Editor as project owner.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '',
  price numeric(12,2) not null check (price > 0),
  category text not null default 'অন্যান্য',
  image_url text,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.store_notices (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) between 1 and 1000),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  customer_name text not null check (char_length(customer_name) between 1 and 160),
  customer_phone text not null check (char_length(customer_phone) between 8 and 30),
  shipping_address text not null check (char_length(shipping_address) between 5 and 1000),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  payment_method text not null check (payment_method in ('cod','bkash','nagad')),
  payment_reference text,
  payment_status text not null default 'pending' check (payment_status in ('pending','verification_required','paid','failed','refunded')),
  order_status text not null default 'pending' check (order_status in ('pending','confirmed','shipped','delivered','cancelled')),
  created_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price > 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total numeric(12,2) not null check (line_total > 0)
);

-- Create a customer profile automatically. Users cannot self-promote to admin via client.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), 'customer')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'); $$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.store_notices enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "profile select self or admin" on public.profiles;
create policy "profile select self or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
-- Deliberately no client INSERT/UPDATE policy on profiles; trigger creates customers, owner assigns admins.
drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "admin insert products" on public.products;
create policy "admin insert products" on public.products for insert to authenticated with check (public.is_admin());
drop policy if exists "admin update products" on public.products;
create policy "admin update products" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete products" on public.products;
create policy "admin delete products" on public.products for delete to authenticated using (public.is_admin());

drop policy if exists "public read published notices" on public.store_notices;
create policy "public read published notices" on public.store_notices for select to anon, authenticated using (is_published or public.is_admin());
drop policy if exists "admin insert notices" on public.store_notices;
create policy "admin insert notices" on public.store_notices for insert to authenticated with check (public.is_admin());
drop policy if exists "admin update notices" on public.store_notices;
create policy "admin update notices" on public.store_notices for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete notices" on public.store_notices;
create policy "admin delete notices" on public.store_notices for delete to authenticated using (public.is_admin());

drop policy if exists "customer read own orders or admin" on public.orders;
create policy "customer read own orders or admin" on public.orders for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "customer read own order items or admin" on public.order_items;
create policy "customer read own order items or admin" on public.order_items for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

-- Order totals and item prices are calculated on the server from the current database price.
-- The function locks products while checking/decrementing stock to reduce overselling.
create or replace function public.place_order(
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address text,
  p_payment_method text,
  p_payment_reference text,
  p_items jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_order_id bigint;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  if char_length(trim(coalesce(p_customer_name,''))) not between 1 and 160 then raise exception 'Invalid customer name'; end if;
  if char_length(trim(coalesce(p_customer_phone,''))) not between 8 and 30 then raise exception 'Invalid phone number'; end if;
  if char_length(trim(coalesce(p_shipping_address,''))) not between 5 and 1000 then raise exception 'Invalid address'; end if;
  if p_payment_method not in ('cod','bkash','nagad') then raise exception 'Invalid payment method'; end if;
  if p_payment_method <> 'cod' and char_length(trim(coalesce(p_payment_reference,''))) not between 3 and 100 then
    raise exception 'Payment transaction reference required';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid cart';
  end if;
  -- Reject duplicate product lines so a crafted request cannot bypass per-line stock checks.
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct value->>'product_id') from jsonb_array_elements(p_items)) then
    raise exception 'Duplicate product lines are not allowed';
  end if;

  -- Validate all lines and lock rows. Client-supplied prices are ignored.
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 99 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and is_active = true
      for update;
    if not found then raise exception 'Product not available'; end if;
    if v_product.stock_quantity < v_qty then raise exception 'Insufficient stock for %', v_product.name; end if;
    v_total := v_total + v_product.price * v_qty;
  end loop;

  insert into public.orders(user_id,customer_name,customer_phone,shipping_address,total_amount,
    payment_method,payment_reference,payment_status)
  values(auth.uid(),trim(p_customer_name),trim(p_customer_phone),trim(p_shipping_address),v_total,
    p_payment_method,nullif(trim(coalesce(p_payment_reference,'')), ''),
    case when p_payment_method='cod' then 'pending' else 'verification_required' end)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid for update;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
    values(v_order_id,v_product.id,v_product.name,v_product.price,v_qty,v_product.price*v_qty);
    update public.products set stock_quantity=stock_quantity-v_qty, updated_at=now() where id=v_product.id;
  end loop;
  return v_order_id;
end; $$;
revoke all on function public.place_order(text,text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,text,jsonb) to authenticated;

-- Keep the REST API from exposing raw internal tables beyond the policies above.
grant usage on schema public to anon, authenticated;
grant select on public.products, public.store_notices to anon, authenticated;
grant select on public.profiles, public.orders, public.order_items to authenticated;
grant insert, update, delete on public.products, public.store_notices to authenticated;
grant update on public.orders to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- After creating your first account, assign its UUID as admin from SQL Editor:
-- update public.profiles set role = 'admin' where id = 'PASTE_AUTH_USER_UUID_HERE';
-- Run this as project owner only. Never expose the service_role key in frontend code.
