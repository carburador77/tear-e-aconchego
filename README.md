# Teia & Aconchego

Nova versão do catálogo em Next.js, TypeScript e Supabase. Os HTMLs anteriores permanecem preservados em `../outputs/`.

## Rodar localmente

1. Copie `.env.example` para `.env.local`.
2. No Supabase, crie um projeto e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. No SQL Editor, execute `supabase/migrations/001_initial_schema.sql` e depois `supabase/seed/001_initial_data.sql`.
4. Crie um usuário no menu **Authentication > Users** e insira o respectivo UUID em `profiles` com papel `admin`:

```sql
insert into public.profiles (id, role) values ('UUID_DO_USUARIO', 'admin');
```

5. Execute `pnpm install` e `pnpm dev`.

## Storage

O SQL cria o bucket público `catalog-images`. Estruture uploads em `site/`, `categories/` e `products/`. As políticas permitem leitura pública e alterações exclusivamente para administradores.

## Deploy na Vercel

1. Importe a pasta `web/` como projeto Vercel.
2. Configure as mesmas duas variáveis de ambiente.
3. Faça o deploy. Depois use a URL pública para criar o QR Code.

## Rotas públicas

- `/` página inicial
- `/catalogo` catálogo completo
- `/catalogo/[slug]` produtos da categoria
- `/produto/[slug]` detalhe e WhatsApp

## Verificação atual

`pnpm build` foi executado com sucesso antes da configuração de credenciais, usando dados de apresentação apenas para permitir desenvolvimento local. Quando o Supabase estiver configurado, as consultas usam as tabelas reais; o catálogo não lê nem grava `localStorage`.
