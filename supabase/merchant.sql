-- Run after supabase/schema.sql to enable the restaurant operations dashboard.
alter table public.orders
  add column if not exists fulfillment_status text not null default 'received'
  check (fulfillment_status in ('received', 'preparing', 'ready', 'out_for_delivery', 'delivered'));

create index if not exists orders_fulfillment_created_idx
  on public.orders (fulfillment_status, created_at desc);

create table if not exists public.restaurant_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'manager' check (role in ('manager', 'staff')),
  created_at timestamptz not null default now()
);

alter table public.restaurant_staff enable row level security;
grant select on public.restaurant_staff to authenticated;
grant all on public.restaurant_staff to service_role;

drop policy if exists "staff can read own membership" on public.restaurant_staff;
create policy "staff can read own membership"
  on public.restaurant_staff for select to authenticated
  using (auth.uid() = user_id);

-- Add a registered account as restaurant staff from the SQL Editor:
-- insert into public.restaurant_staff (user_id, role)
-- select id, 'manager' from auth.users where email = 'owner@example.com'
-- on conflict (user_id) do update set role = excluded.role;
