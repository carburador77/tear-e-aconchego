create table public.product_variant_images (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(id) on delete cascade,
  image_url text not null check (length(trim(image_url)) > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variant_images_variant_order_idx
  on public.product_variant_images(product_variant_id, sort_order, created_at);

create unique index product_variant_images_one_primary_idx
  on public.product_variant_images(product_variant_id)
  where is_primary;

create trigger product_variant_images_touch
before update on public.product_variant_images
for each row execute function public.touch_updated_at();

alter table public.product_variant_images enable row level security;

grant select on table public.product_variant_images to anon, authenticated;
grant insert, update, delete on table public.product_variant_images to authenticated;

create policy "public reads images of active variants"
on public.product_variant_images for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.product_variants
    join public.products on products.id = product_variants.product_id
    join public.categories on categories.id = products.category_id
    where product_variants.id = product_variant_images.product_variant_id
      and product_variants.active
      and products.active
      and categories.active
  )
);

create policy "admins manage variant images"
on public.product_variant_images for all
using (public.is_admin())
with check (public.is_admin());

insert into public.product_variant_images (
  product_variant_id,
  image_url,
  sort_order,
  is_primary
)
select
  product_variants.id,
  product_variants.image_url,
  0,
  true
from public.product_variants
where product_variants.image_url is not null
  and length(trim(product_variants.image_url)) > 0
  and not exists (
    select 1
    from public.product_variant_images
    where product_variant_images.product_variant_id = product_variants.id
  );

comment on table public.product_variant_images is
  'Galeria ordenada de imagens de cada cor/variação. product_variants.image_url permanece somente para transição e não recebe novas gravações.';
