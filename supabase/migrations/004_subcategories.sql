create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  slug text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);

alter table public.products
  add column subcategory_id uuid references public.subcategories(id) on delete set null;

create index subcategories_category_idx on public.subcategories(category_id, active, name);
create index products_subcategory_idx on public.products(subcategory_id);

create trigger subcategories_touch
before update on public.subcategories
for each row execute function public.touch_updated_at();

create or replace function public.validate_product_subcategory_category()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.subcategory_id is not null and not exists (
    select 1
    from public.subcategories
    where id = new.subcategory_id
      and category_id = new.category_id
  ) then
    raise exception 'A subcategoria selecionada não pertence à categoria do produto.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger products_validate_subcategory
before insert or update of category_id, subcategory_id on public.products
for each row execute function public.validate_product_subcategory_category();

alter table public.subcategories enable row level security;

create policy "public reads active subcategories"
on public.subcategories for select
using (active or public.is_admin());

create policy "admins manage subcategories"
on public.subcategories for all
using (public.is_admin())
with check (public.is_admin());
