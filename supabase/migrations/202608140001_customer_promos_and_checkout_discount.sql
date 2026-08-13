alter table public.promo_codes add column if not exists user_id uuid null references auth.users(id) on delete cascade;
create index if not exists promo_codes_user_id_created_at_idx on public.promo_codes(user_id,created_at desc) where user_id is not null;
update public.promo_codes p set user_id=u.id from auth.users u where p.user_id is null and split_part(p.code,'-',2)=upper(substr(replace(u.id::text,'-',''),1,6));
grant select on public.promo_codes to authenticated;
drop policy if exists "customers can view own promo codes" on public.promo_codes;
create policy "customers can view own promo codes" on public.promo_codes for select to authenticated using ((select auth.uid())=user_id);

drop function if exists public.create_storefront_order(text,text,text,text,timestamptz,text,jsonb);
drop function if exists private.create_storefront_order(text,text,text,text,timestamptz,text,jsonb);
create or replace function private.create_storefront_order(p_name text,p_phone text,p_fulfillment text,p_address text,p_delivery_at timestamptz,p_comment text,p_items jsonb,p_promo_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order_id uuid;v_public_number bigint;v_subtotal bigint;v_valid_items integer;v_item_count integer;v_discount bigint:=0;v_total bigint;v_promo public.promo_codes%rowtype;v_code text:=upper(btrim(coalesce(p_promo_code,'')));
begin
 if char_length(btrim(p_name))<2 or char_length(btrim(p_name))>80 then raise exception 'Invalid customer name';end if;
 if char_length(btrim(p_phone))<7 or char_length(btrim(p_phone))>30 then raise exception 'Invalid phone';end if;
 if p_fulfillment not in ('delivery','pickup') then raise exception 'Invalid fulfillment';end if;
 if p_fulfillment='delivery' and char_length(btrim(p_address))<5 then raise exception 'Invalid delivery address';end if;
 if p_delivery_at<now()-interval '1 minute' then raise exception 'Invalid delivery time';end if;
 if jsonb_typeof(p_items)<>'array' then raise exception 'Invalid items';end if;
 v_item_count:=jsonb_array_length(p_items);if v_item_count<1 or v_item_count>20 then raise exception 'Invalid item count';end if;
 select count(*),coalesce(sum(p.price_minor*(item.value->>'quantity')::integer),0) into v_valid_items,v_subtotal from jsonb_array_elements(p_items)item(value) join public.products p on p.id=(item.value->>'productId')::uuid where p.is_available and p.is_published and (item.value->>'quantity')::integer between 1 and 20;
 if v_valid_items<>v_item_count then raise exception 'One or more products are unavailable';end if;
 if v_code<>'' then
  select * into v_promo from public.promo_codes where code=v_code for update;
  if not found or not v_promo.is_active or (v_promo.starts_at is not null and v_promo.starts_at>now()) or (v_promo.ends_at is not null and v_promo.ends_at<now()) or (v_promo.max_uses is not null and v_promo.uses_count>=v_promo.max_uses) or (v_promo.user_id is not null and v_promo.user_id is distinct from (select auth.uid())) then raise exception 'Invalid promo code';end if;
  v_discount:=floor(v_subtotal*v_promo.discount_percent/100.0);
 end if;
 v_total:=greatest(v_subtotal-v_discount,0);
 insert into public.orders(user_id,status,payment_status,customer_name,customer_phone,recipient_name,recipient_phone,delivery_address,delivery_at,is_anonymous,customer_comment,card_text,currency,subtotal_minor,delivery_price_minor,discount_minor,total_minor,promo_code) values((select auth.uid()),'new','pending',btrim(p_name),btrim(p_phone),btrim(p_name),btrim(p_phone),case when p_fulfillment='delivery' then btrim(p_address) else 'Самовывоз' end,p_delivery_at,(select auth.uid()) is null,case when btrim(coalesce(p_comment,''))='' then case when p_fulfillment='delivery' then 'Доставка' else 'Самовывоз' end else (case when p_fulfillment='delivery' then 'Доставка' else 'Самовывоз' end)||' · '||btrim(p_comment) end,'','RUB',v_subtotal,0,v_discount,v_total,nullif(v_code,'')) returning id,public_number into v_order_id,v_public_number;
 insert into public.order_items(order_id,product_id,product_name,unit_price_minor,quantity,line_total_minor) select v_order_id,p.id,p.name,p.price_minor,(item.value->>'quantity')::integer,p.price_minor*(item.value->>'quantity')::integer from jsonb_array_elements(p_items)item(value) join public.products p on p.id=(item.value->>'productId')::uuid;
 if v_code<>'' then update public.promo_codes set uses_count=uses_count+1 where id=v_promo.id;end if;
 return jsonb_build_object('publicNumber',v_public_number,'subtotalMinor',v_subtotal,'discountMinor',v_discount,'totalMinor',v_total,'promoCode',nullif(v_code,''));
end;$$;
create or replace function public.create_storefront_order(p_name text,p_phone text,p_fulfillment text,p_address text,p_delivery_at timestamptz,p_comment text,p_items jsonb,p_promo_code text) returns jsonb language sql security invoker set search_path='' as $$select private.create_storefront_order(p_name,p_phone,p_fulfillment,p_address,p_delivery_at,p_comment,p_items,p_promo_code);$$;
revoke all on function private.create_storefront_order(text,text,text,text,timestamptz,text,jsonb,text) from public;
revoke all on function public.create_storefront_order(text,text,text,text,timestamptz,text,jsonb,text) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.create_storefront_order(text,text,text,text,timestamptz,text,jsonb,text) to anon,authenticated;
grant execute on function public.create_storefront_order(text,text,text,text,timestamptz,text,jsonb,text) to anon,authenticated;
