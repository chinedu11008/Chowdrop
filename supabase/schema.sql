create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  user_id uuid not null references auth.users on delete cascade,
  items jsonb not null,
  total integer not null,
  status text not null default 'pending', -- pending | paid | cod
  name text, phone text, address text,
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
-- Customers can only read their own orders. All writes go through the Edge Functions.
create policy "read own orders" on public.orders for select using (auth.uid() = user_id);
