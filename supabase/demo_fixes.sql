-- Apply after schema.sql and merchant.sql.
-- Adds checkout idempotency, price snapshots, and an atomic COD order limit.
alter table public.orders
  add column if not exists checkout_id uuid,
  add column if not exists paystack_access_code text;

create unique index if not exists orders_user_checkout_id_idx
  on public.orders (user_id, checkout_id)
  where checkout_id is not null;

drop policy if exists "restaurant staff can read fulfillment orders" on public.orders;
create policy "restaurant staff can read fulfillment orders"
  on public.orders for select to authenticated
  using (
    status in ('paid', 'cod')
    and exists (
      select 1 from public.restaurant_staff rs
      where rs.user_id = auth.uid()
        and (rs.role = 'manager' or fulfillment_status <> 'delivered')
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end;
$$;

create or replace function public.create_order_for_checkout(
  p_reference text,
  p_user_id uuid,
  p_checkout_id uuid,
  p_items jsonb,
  p_total integer,
  p_name text,
  p_phone text,
  p_address text,
  p_is_cod boolean
)
returns table (
  order_id uuid,
  order_reference text,
  order_status text,
  access_code text,
  created boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_order public.orders%rowtype;
  created_id uuid;
  open_cod_count integer;
begin
  -- Serialize check-and-insert per customer so concurrent requests cannot
  -- bypass the open COD limit or create duplicate orders for one checkout.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 76421));

  select * into existing_order
  from public.orders o
  where o.user_id = p_user_id and o.checkout_id = p_checkout_id
  for update;

  if found then
    if existing_order.total is distinct from p_total
      or existing_order.items is distinct from p_items
      or existing_order.name is distinct from p_name
      or existing_order.phone is distinct from p_phone
      or existing_order.address is distinct from p_address
      or (p_is_cod and existing_order.status <> 'cod')
      or (not p_is_cod and existing_order.status = 'cod') then
      raise exception 'Checkout ID was already used for different order details.'
        using errcode = '22023';
    end if;

    return query select existing_order.id, existing_order.reference,
      existing_order.status, existing_order.paystack_access_code, false;
    return;
  end if;

  if p_is_cod then
    select count(*) into open_cod_count
    from public.orders o
    where o.user_id = p_user_id
      and o.status = 'cod'
      and o.fulfillment_status <> 'delivered';

    if open_cod_count >= 3 then
      raise exception 'You already have 3 open cash-on-delivery orders.'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.orders (
    reference, user_id, checkout_id, items, total, status, name, phone, address
  ) values (
    p_reference, p_user_id, p_checkout_id, p_items, p_total,
    case when p_is_cod then 'cod' else 'pending' end,
    p_name, p_phone, p_address
  ) returning id into created_id;

  return query select created_id, p_reference,
    case when p_is_cod then 'cod' else 'pending' end,
    null::text, true;
end;
$$;

revoke all on function public.create_order_for_checkout(
  text, uuid, uuid, jsonb, integer, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.create_order_for_checkout(
  text, uuid, uuid, jsonb, integer, text, text, text, boolean
) to service_role;
