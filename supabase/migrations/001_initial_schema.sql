create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  image_url text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(12,2),
  image_url text,
  origin text,
  dimensions text,
  care text,
  whatsapp_url text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.benefits (
  id uuid primary key default gen_random_uuid(),
  icon text not null default '♡',
  title text not null,
  description text not null default '',
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create index categories_public_idx on public.categories(active, display_order);
create index products_public_idx on public.products(category_id, active, display_order);
create index benefits_public_idx on public.benefits(active, display_order);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.benefits enable row level security;
alter table public.site_settings enable row level security;
alter table public.profiles enable row level security;

create policy "public reads active categories" on public.categories for select using (active or public.is_admin());
create policy "public reads active products" on public.products for select using (active or public.is_admin());
create policy "public reads active benefits" on public.benefits for select using (active or public.is_admin());
create policy "public reads site settings" on public.site_settings for select using (true);
create policy "admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage benefits" on public.benefits for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage settings" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "users read own profile" on public.profiles for select using (id = auth.uid());

insert into storage.buckets (id, name, public) values ('catalog-images','catalog-images',true) on conflict (id) do nothing;
create policy "public reads catalog images" on storage.objects for select using (bucket_id = 'catalog-images');
create policy "admins manage catalog images" on storage.objects for all using (bucket_id = 'catalog-images' and public.is_admin()) with check (bucket_id = 'catalog-images' and public.is_admin());
