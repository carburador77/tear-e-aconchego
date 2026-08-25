# Tear & Aconchego

Catálogo público e painel administrativo construídos com Next.js, TypeScript e Supabase. Os HTMLs anteriores permanecem preservados em `../outputs/` e não participam da aplicação publicada.

## Pré-requisitos

- Node.js 20 ou superior;
- pnpm 11;
- projeto no Supabase;
- projeto na Vercel para a publicação.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha apenas com as credenciais públicas do projeto:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=
```

`NEXT_PUBLIC_SITE_URL` deve ser a origem pública, sem barra final, por exemplo `https://seu-dominio.vercel.app`. A aplicação também aceita temporariamente `NEXT_PUBLIC_SUPABASE_ANON_KEY` no lugar da chave publicável, para compatibilidade. Nunca use a chave `service_role` em uma variável `NEXT_PUBLIC_`, no repositório ou no navegador.

## Preparar o Supabase

Em um projeto novo, abra **Supabase → SQL Editor** e execute nesta ordem:

1. `supabase/migrations/001_initial_schema.sql`;
2. `supabase/seed/001_initial_data.sql`;
3. `supabase/migrations/002_brand_name.sql`;
4. `supabase/migrations/003_product_variants.sql`;
5. `supabase/migrations/004_subcategories.sql`.

Depois de revisar e aprovar a galeria de imagens por cor, execute também:

6. `supabase/migrations/005_product_variant_images.sql`.

Em um projeto existente, execute somente as migrations ainda não aplicadas, sempre na ordem. Enquanto a migration 005 não for aplicada, o catálogo continua exibindo as imagens antigas, mas o painel mantém desabilitadas as ações de múltiplas imagens.

Uma proposta futura de hardening está arquivada em `supabase/archive/` com extensão não executável. Ela serve apenas como referência e não é considerada pelo fluxo atual do Supabase CLI.

O SQL cria o bucket público `catalog-images`. As imagens do catálogo são públicas; upload, substituição e exclusão exigem uma sessão administrativa. O painel aceita JPEG, PNG e WebP de até 5 MiB, organizados em `products/`, `categories/` e `site/`. Cada cor pode possuir até oito imagens; a migration 005 preserva a foto antiga de cada variação como sua primeira imagem principal.

## Criar o administrador

1. Abra **Supabase → Authentication → Users → Add user**.
2. Copie o UUID criado.
3. No **SQL Editor**, substitua o valor indicado e execute:

```sql
insert into public.profiles (id, role)
values ('UUID_DO_USUARIO', 'admin')
on conflict (id) do update set role = excluded.role;
```

Ter uma conta autenticada, sem o perfil `admin`, não autoriza escrita. A proteção existe nas rotas e também nas policies RLS/Storage.

## Instalar, executar e validar

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Antes de qualquer commit ou deploy, execute:

```bash
pnpm check
```

Esse comando executa lint, verificação TypeScript e build de produção. Não há suíte automatizada de integração neste momento; os fluxos críticos do painel ainda devem ser validados em um preview com uma conta administrativa.

## Rotas

Públicas:

- `/` — página inicial;
- `/catalogo` — catálogo, busca e filtros;
- `/catalogo/[slug]` — categoria e subcategoria;
- `/produto/[slug]` — produto, variações, seleção e WhatsApp;
- `/minha-selecao` — seleção local do visitante.

Administrativas:

- `/admin/login` — autenticação;
- `/admin` — painel;
- `/admin/categorias` — categorias e subcategorias;
- `/admin/produtos` — produtos e variações;
- `/admin/produtos/cadastro-em-lote` — cadastro em lote;
- `/admin/produtos/edicao-em-lote` — edição em lote;
- `/admin/configuracoes` — marca, capa, contato e cores do site.

Os dados do catálogo vêm do Supabase. O `localStorage` é usado somente pela funcionalidade **Minha Seleção**, contendo IDs e quantidades, sem dados pessoais.

## Publicar com segurança na Vercel

1. Crie uma branch e envie as alterações para o GitHub.
2. Gere um Preview Deploy na Vercel.
3. Em **Vercel → Project → Settings → Environment Variables**, cadastre as três variáveis de ambiente para Preview e Production.
4. Em **Supabase → Authentication → URL Configuration**, mantenha a URL de produção em **Site URL**. Adicione URLs de preview em **Redirect URLs** somente se forem usados fluxos de e-mail/OAuth.
5. No preview, valide login/logout, criação/edição/exclusão, upload/substituição de imagem e as páginas públicas.
6. Execute `pnpm check` localmente e só então faça merge para a branch conectada à produção.

O código não exige `localhost` para falar com o Supabase. O navegador usa somente a URL e a chave pública; autorização de escrita continua sendo aplicada por sessão, perfil e RLS.

## Checklist de regressão do preview

- home, cabeçalho, rodapé e links externos;
- catálogo, busca, categoria e subcategoria;
- produto inexistente e categoria inexistente retornam página 404;
- produto, variações, setas, cores, relacionados e WhatsApp;
- Minha Seleção: adicionar, quantidade, reload, duas abas, item removido e limpar;
- login, logout e tentativa de acesso direto a todas as rotas `/admin`;
- cadastro e edição individual/em lote;
- upload, substituição e exclusão de imagens;
- conflitos de edição em duas abas exibem aviso em vez de sobrescrever silenciosamente.

## Monitoramento e recuperação

- **Vercel → Project → Logs**: erros de renderização, rotas e deploy;
- **Supabase → Logs → Postgres/Auth/Storage**: falhas de banco, login, RLS e arquivos;
- **Supabase → Database → Backups**: confirme a retenção disponível no plano antes de migrations;
- **GitHub/Vercel**: para voltar o código, reverta o commit ou promova o último deploy validado;
- para alterações de banco, prefira uma nova migration corretiva. Não reverta apagando colunas ou dados em produção.

Não há plataforma paga de observabilidade instalada. Para o tamanho atual, logs da Vercel e Supabase são o ponto de partida; alertas externos podem ser avaliados quando houver volume/necessidade comprovados.

## Limitações operacionais conhecidas

- imagens originais já armazenadas podem ser grandes; a validação de 5 MiB vale para novos uploads, não recomprime o acervo existente;
- as páginas públicas priorizam atualização imediata após mudanças administrativas e, por isso, não usam um cache longo;
- testes de carga devem ser executados somente contra staging/preview isolado, nunca contra produção ou contra o mesmo Supabase de produção.
