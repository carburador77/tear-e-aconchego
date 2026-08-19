create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  color_name text not null,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  image_url text,
  display_order integer not null default 0,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_public_idx on public.product_variants(product_id,active,display_order);
create unique index product_variants_one_default_idx on public.product_variants(product_id) where is_default;
create trigger product_variants_touch before update on public.product_variants for each row execute function public.touch_updated_at();
alter table public.product_variants enable row level security;
create policy "public reads active variants" on public.product_variants for select using (active or public.is_admin());
create policy "admins manage variants" on public.product_variants for all using (public.is_admin()) with check (public.is_admin());
