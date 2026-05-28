## Objetivo

Transformar a seção **Tutoriais** (hoje 100% estática em `src/data/tutoriais/*.ts`) em um sistema gerenciável pelo painel — criar, editar, excluir tutoriais e steps, com upload de imagens — restrito a **Diretor** e **Admin Master**.

## Escopo

- Migrar os 4 tutoriais existentes (incluindo Troca de Titularidade) para o banco.
- Operadores comuns continuam vendo/lendo tutoriais como hoje.
- Diretor / Admin Master ganham botões de gerenciar (Novo, Editar, Excluir) na lista e no detalhe.

## Mudanças

### 1. Banco (migração)

```sql
create table public.tutoriais (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  titulo text not null,
  descricao text not null,
  categoria text not null,
  tempo_estimado_min int not null default 5,
  novo boolean not null default false,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tutoriais_steps (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.tutoriais(id) on delete cascade,
  numero int not null,
  titulo text not null,
  descricao text not null,
  imagem_url text,
  dicas jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (tutorial_id, numero)
);
```

- `GRANT SELECT` para `anon` + `authenticated` (tutorial é leitura aberta a logados).
- `GRANT INSERT/UPDATE/DELETE` só para `authenticated` + RLS exigindo `has_role(auth.uid(),'diretor') OR has_role(auth.uid(),'admin_master')`.
- Bucket de Storage `tutoriais` (público para leitura) com policy de upload restrita às mesmas roles.
- Seed dos 4 tutoriais atuais (incluindo imagens já importadas — mantemos os assets locais como `imagem_url` apontando para os imports atuais? não — vamos copiar URLs para storage no seed, OU manter referência pelo caminho original servido pelo build).

> Decisão: o seed grava `imagem_url` com o caminho importado atual (string vazia ou null) — as imagens existentes ficam embarcadas no front via fallback. Novas imagens vão para Storage. Vou anexar um fallback no front: se `imagem_url` começa com `local:troca-titularidade-busca` etc., resolve via mapa de imports; senão usa URL direta.

### 2. Hooks

- `src/hooks/useTutoriais.ts` — `useTutoriais()`, `useTutorial(slug)`, `useCreateTutorial`, `useUpdateTutorial`, `useDeleteTutorial`, `useUpsertStep`, `useDeleteStep`, `useUploadTutorialImage`.

### 3. UI

- `src/pages/tutoriais/TutoriaisLista.tsx` — ler do hook em vez do array estático; mostrar botões `+ Novo Tutorial` e ícones de editar/excluir nos cards (gated por role).
- `src/pages/tutoriais/TutorialDetalhe.tsx` — botão `Editar` (abre modal de gerenciamento) gated por role.
- Novo: `src/components/tutoriais/TutorialEditorDialog.tsx` — formulário com campos do tutorial + lista editável de steps (adicionar/remover/reordenar/upload imagem/editar texto/dicas/links).
- Novo: `src/components/tutoriais/StepEditorRow.tsx` — uma linha editável de step.

### 4. Limpeza / compat

- `src/data/tutoriais/*` continua existindo só como "seed" para a migração. Os componentes deixam de importar dele.
- Página continua na rota `/tutoriais` e `/tutoriais/:slug`.

## Critérios de aceite

- Operador comum: vê os mesmos tutoriais de hoje (Troca de Titularidade etc.), sem botões de edição.
- Diretor / Admin Master: vê botões `+ Novo Tutorial`, `Editar`, `Excluir` na lista e no detalhe; consegue criar tutorial novo do zero, adicionar steps com imagem (upload) + descrição + dicas + links, salvar, editar depois e excluir.
- Excluir tutorial cascateia steps e imagens órfãs no Storage (cleanup best-effort).
- RLS bloqueia escrita para qualquer role fora de Diretor/Admin Master mesmo via API.

Confirma que sigo nesse formato (DB + Storage + CRUD UI)?
