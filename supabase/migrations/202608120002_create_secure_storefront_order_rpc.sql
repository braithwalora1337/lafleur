create schema if not exists private;

create or replace function private.create_storefront_order(p_name text, p_phone text, p_fulfillment text, p_address text, p_delivery_at timestamptz, p_comment text, p_items jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid; v_public_number bigint; v_subtotal bigint; v_valid_items integer; v_item_count integer;
begin
  if char_length(btrim(p_name)) < 2 or char_length(btrim(p_name)) > 80 then raise exception 'Invalid customer name'; end if;
  if char_length(btrim(p_phone)) < 7 or char_length(btrim(p_phone)) > 30 then raise exception 'Invalid phone'; end if;
  if p_fulfillment not in ('delivery', 'pickup') then raise exception 'Invalid fulfillment'; end if;
  if p_fulfillment = 'delivery' and char_length(btrim(p_address)) < 5 then raise exception 'Invalid delivery address'; end if;
  if p_delivery_at < now() - interval '1 minute' then raise exception 'Invalid delivery time'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid items'; end if;
  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 20 then raise exception 'Invalid item count'; end if;
  select count(*), coalesce(sum(p.price_minor * (item.value->>'quantity')::integer), 0) into v_valid_items, v_subtotal
  from jsonb_array_elements(p_items) item(value) join public.products p on p.id = (item.value->>'productId')::uuid
  where p.is_available and p.is_published and (item.value->>'quantity')::integer between 1 and 20;
  if v_valid_items <> v_item_count then raise exception 'One or more products are unavailable'; end if;
  insert into public.orders(user_id,status,payment_status,customer_name,customer_phone,recipient_name,recipient_phone,delivery_address,delivery_at,is_anonymous,customer_comment,card_text,currency,subtotal_minor,delivery_price_minor,discount_minor,total_minor)
  values ((select auth.uid()),'new','pending',btrim(p_name),btrim(p_phone),btrim(p_name),btrim(p_phone),case when p_fulfillment='delivery' then btrim(p_address) else 'Самовывоз' end,p_delivery_at,(select auth.uid()) is null,case when btrim(coalesce(p_comment,''))='' then case when p_fulfillment='delivery' then 'Доставка' else 'Самовывоз' end else (case when p_fulfillment='delivery' then 'Доставка' else 'Самовывоз' end)||' · '||btrim(p_comment) end,'','RUB',v_subtotal,0,0,v_subtotal)
  returning id,public_number into v_order_id,v_public_number;
  insert into public.order_items(order_id,product_id,product_name,unit_price_minor,quantity,line_total_minor)
  select v_order_id,p.id,p.name,p.price_minor,(item.value->>'quantity')::integer,p.price_minor*(item.value->>'quantity')::integer
  from jsonb_array_elements(p_items) item(value) join public.products p on p.id=(item.value->>'productId')::uuid;
  return v_public_number;
end; $$;

create or replace function public.create_storefront_order(p_name text,p_phone text,p_fulfillment text,p_address text,p_delivery_at timestamptz,p_comment text,p_items jsonb)
returns bigint language sql security invoker set search_path = '' as $$ select private.create_storefront_order(p_name,p_phone,p_fulfillment,p_address,p_delivery_at,p_comment,p_items); $$;
revoke all on function private.create_storefront_order(text,text,text,text,timestamptz,text,jsonb) from public;
revoke all on function public.create_storefront_order(text,text,text,text,timestamptz,text,jsonb) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.create_storefront_order(text,text,text,text,timestamptz,text,jsonb) to anon,authenticated;
grant execute on function public.create_storefront_order(text,text,text,text,timestamptz,text,jsonb) to anon,authenticated;
