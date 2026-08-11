alter table public.orders
  add column if not exists user_id uuid null references auth.users(id) on delete set null;

create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc)
  where user_id is not null;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

drop policy if exists "customers can view own orders" on public.orders;
create policy "customers can view own orders"
  on public.orders for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "customers can view own order items" on public.order_items;
create policy "customers can view own order items"
  on public.order_items for select to authenticated
  using (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = (select auth.uid())));
