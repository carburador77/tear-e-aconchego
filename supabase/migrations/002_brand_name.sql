update public.site_settings
set value = jsonb_set(jsonb_set(value, '{name}', '"Tear & Aconchego"'::jsonb, true), '{footer}', '"Tear & Aconchego – Arte em cada detalhe"'::jsonb, true), updated_at = now()
where key = 'brand';
