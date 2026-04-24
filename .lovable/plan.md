# Sistema de Relatos de Erros

Implementar um canal interno onde qualquer usuário (qualquer perfil) pode relatar bugs com prints, e o Diretor gerencia o ciclo de vida do reporte (Aberto → Em tratamento → Concluído → Validado pelo autor).

## Fluxo geral

```text
Usuário              Diretor                  Usuário (autor)
  │                     │                         │
  ▼                     ▼                         ▼
Relatar erro  ─►  Aberto  ─►  Em tratamento  ─►  Concluído
(área, descrição,                                  │
 prints multi-arquivo)                             ▼
                                          Badge "TESTAR" (piscando)
                                                   │
                                                   ▼
                                              Validado!
```

## 1. Backend (Lovable Cloud / Supabase)

**Migration nova** com:

- Enum `error_report_status`: `aberto`, `em_tratamento`, `concluido`, `validado`.
- Tabela `public.error_reports`:
  - `id uuid pk`, `created_at`, `updated_at`
  - `reporter_id uuid` (auth.users) — autor
  - `reporter_nome text`, `reporter_email text` (snapshot)
  - `area text not null` (texto livre informado pelo usuário)
  - `descricao text not null`
  - `status error_report_status default 'aberto'`
  - `tratado_por uuid`, `tratado_em timestamptz`
  - `concluido_por uuid`, `concluido_em timestamptz`
  - `validado_em timestamptz`
  - `observacao_diretor text` (opcional para resposta)
- Tabela `public.error_report_files`:
  - `id`, `report_id fk`, `storage_path text`, `mime_type`, `tamanho_bytes`, `nome_original`, `created_at`.
- **Bucket de storage** novo `relatos-erros` (privado).
- **RLS**:
  - `error_reports` SELECT: autor vê só os seus; `has_role(auth.uid(),'diretor')` ou `desenvolvedor` vê todos.
  - INSERT: qualquer usuário autenticado, com `reporter_id = auth.uid()`.
  - UPDATE: Diretor/Desenvolvedor pode mudar para `em_tratamento`/`concluido`; autor pode mudar de `concluido` → `validado` (somente os seus).
  - `error_report_files`: mesma regra via join.
- **Storage policies** no bucket `relatos-erros`:
  - INSERT: autenticado, prefixo do path = `auth.uid()/...`.
  - SELECT: dono do path **OU** Diretor/Desenvolvedor.

## 2. Hook compartilhado

`src/hooks/useErrorReports.ts`:
- `useMyPendingValidations()` — conta reports do usuário com `status = 'concluido'` (alimenta o efeito "piscando").
- `useErrorReportsList(filtros)` — usado pela tela do Diretor.
- `useCreateErrorReport()` — insere registro + faz upload dos arquivos para `relatos-erros/{user_id}/{report_id}/{filename}` e cria linhas em `error_report_files`.
- `useUpdateErrorReportStatus()` — transições conforme papel.
- `useErrorReportFiles(reportId)` — gera signed URLs para visualização/download.

## 3. Modal "Relatar Erro" (todos os perfis)

Novo componente `src/components/suporte/RelatarErroModal.tsx`:
- Campos:
  - **Área** — `Input` texto (obrigatório, máx 120).
  - **Descrição / Passo a passo** — `Textarea` (obrigatório, mín 20 / máx 4000).
  - **Prints do erro** — `Input type="file" multiple accept="image/*,application/pdf"` com preview em grid e botão remover. Limite: 10 arquivos, 10MB cada.
- Validação com `zod`.
- Botão **Enviar** → chama `useCreateErrorReport`, exibe toast de sucesso e fecha.

Adicionar item **"Relatar Erro"** (ícone `Bug`) **logo abaixo de "Meu Perfil"** em:
- `src/components/layout/AppHeader.tsx` (dropdown principal — usado pela maioria dos perfis incluindo Diretor).
- `src/components/app/AppUserDropdown.tsx` (associado/PWA).
- Outros dropdowns de perfis especiais que estendem header próprio (Instalador, Regulador, Analista de Eventos) — adicionar mesmo item para garantir cobertura "todo perfil".

O item abre o `RelatarErroModal` (estado local).

## 4. Badge "TESTAR" piscando (autor)

- Hook `useMyPendingValidations` retorna `count`.
- Quando `count > 0`, exibir um botão/badge no header (próximo ao `NotificationBell`) chamado **"Testar correções"** com pulso (`animate-pulse` + cor `bg-warning`).
- Clique → abre `Sheet/Dialog` listando reports `concluido` do usuário, com botão **"Validado!"** por item, que chama `updateStatus → 'validado'`.
- Esse mesmo indicador entra no `AppUserDropdown` (mobile) como item "Testar correções (N)" piscando.

## 5. Tela do Diretor — "Relatórios de Erros"

Nova rota `/diretoria/relatos-erros` e nova página `src/pages/diretoria/RelatosErros.tsx`.

Adicionar entrada no `AppSidebar.tsx`, módulo **Diretoria**, **acima de "Configurações"**:
```ts
{ title: 'Relatos de Erros', url: '/diretoria/relatos-erros', icon: Bug },
```
Registrar a rota em `src/App.tsx` com guard de Diretor/Desenvolvedor.

Conteúdo da página:
- Cards de resumo: Aberto / Em tratamento / Concluído / Validado.
- Filtros: status, busca por área/descrição/autor, range de datas.
- Tabela: data, autor, área, status (badge), nº de arquivos, ação "Ver detalhes".
- **Modal de detalhes** (`DetalheRelatoModal.tsx`):
  - Cabeçalho com autor, e-mail, área, criado em, status.
  - Descrição completa.
  - Galeria de arquivos: thumbnails (imagens) com clique para abrir em nova aba via signed URL; ícone para PDFs/outros com botão "Abrir".
  - Campo **Observação do Diretor** (opcional).
  - Botões de transição:
    - Em **Aberto**: "Iniciar tratamento" → `em_tratamento`.
    - Em **Em tratamento**: "Marcar como Concluído" → `concluido`.
    - Em **Concluído / Validado**: somente leitura (badge final).
  - Timeline lateral: Aberto em / Em tratamento em / Concluído em / Validado em.

## 6. Detalhes técnicos

- Ícone `Bug` do `lucide-react`.
- Animação piscante: classe utilitária Tailwind `animate-pulse` combinada com `ring-2 ring-warning`.
- Upload usa `supabase.storage.from('relatos-erros').upload(path, file)` em paralelo com `Promise.all`, depois insere registros em `error_report_files`. Em caso de falha parcial, remover arquivos órfãos e marcar erro.
- Signed URLs: `createSignedUrl(path, 3600)` ao abrir o modal de detalhes.
- Realtime opcional: subscribe em `error_reports` filtrando por `reporter_id` para refletir mudança de status (Concluído) sem refresh — usar canal já existente do projeto.
- Reaproveitar componentes: `Dialog`, `Sheet`, `Badge`, `Button`, `Input`, `Textarea`, `DataTable` simples com `Table` shadcn.

## Arquivos a criar / editar

**Criar**
- `supabase/migrations/<ts>_error_reports.sql`
- `src/hooks/useErrorReports.ts`
- `src/components/suporte/RelatarErroModal.tsx`
- `src/components/suporte/TestarCorrecoesButton.tsx`
- `src/components/suporte/TestarCorrecoesSheet.tsx`
- `src/pages/diretoria/RelatosErros.tsx`
- `src/components/diretoria/DetalheRelatoModal.tsx`

**Editar**
- `src/components/layout/AppHeader.tsx` (item Relatar Erro + botão Testar)
- `src/components/layout/AppSidebar.tsx` (entrada "Relatos de Erros" no grupo Diretoria, acima de "Configurações")
- `src/components/app/AppUserDropdown.tsx` (item Relatar Erro + indicador Testar)
- Dropdowns equivalentes em layouts especiais (Instalador/Regulador/Analista de Eventos) — incluir o item Relatar Erro
- `src/App.tsx` (rota `/diretoria/relatos-erros`)
- `src/integrations/supabase/types.ts` (regenerado pela migration)

## Fora do escopo
- Notificações por e-mail/WhatsApp ao Diretor (pode ser adicionado depois).
- Comentários/threads dentro do report (somente uma observação do Diretor por enquanto).
