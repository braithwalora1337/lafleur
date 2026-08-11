alter type public.order_status add value if not exists 'assembled' after 'in_progress';
alter type public.order_status add value if not exists 'ready_for_pickup' after 'assembled';
alter type public.order_status add value if not exists 'ready_for_delivery' after 'ready_for_pickup';
