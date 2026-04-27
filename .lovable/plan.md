# Plano — Fila de Relatos de Erros do Diretor (filtros, IA e gerar prompt)

## Estado atual (já implementado)

- Tabela `error_reports` com enum `aberto | em_tratamento | concluido | validado`, RLS ok.
- Página `/diretoria/relatos-erros` com cards de contagem, abas por status, busca textual, tabela com autor/email, modal de detalhe com anexos e botões "Iniciar tratamento" / "Marcar como concluído".
- Fluxo do autor: sheet "Testar correções" lista concluídos e permite marcar `validado`.
- O autor (nome + email) **já é exibido** na lista e no modal — então este pedido já está atendido. Vou apenas reforçar a coluna no header.

## Gaps a resolver

1. Falta status **`descartado`** (com data e responsável).
2. Filtros: somente busca textual + abas. Falta **filtro por usuário** (combobox) e **filtro por intervalo de datas**.
3. Falta visão de **fila** (cards priorizados por idade, separando "novos" de "em tratamento") em vez/além da tabela.
4. Falta aba de **histórico completo** (todas as transições de status com quem/quando — log de auditoria), separada da fila operacional.
5. No modal de detalhes do diretor:
   - Falta **botão "Melhorar texto com IA"** sobre a descrição (reescreve mantendo significado, mais técnico, com contexto do sistema).
   - Falta **botão "Gerar prompt"** que analisa a descrição + imagens anexadas + contexto do sistema (área, rota, módulos relacionados) e produz um prompt pronto para colar no chat do Lovable, com botão de copiar.
6. Botão "Descartar" + "Voltar para usuário testar" (já existe via "concluído", manter texto explícito).

## Mudanças

### 1. Banco

- **Migration**: adicionar `descartado` ao enum `error_report_status`; adicionar colunas `descartado_em timestamptz`, `descartado_por uuid`, `motivo_descarte text` em `error_reports`.
- **Tabela nova `error_report_history`** (auditoria de transições):
  - `id`, `report_id` (FK), `from_status`, `to_status`, `changed_by` (uuid), `changed_by_nome` (snapshot), `observacao` (texto opcional), `created_at`.
  - RLS: SELECT para autor do report **ou** admin; INSERT só via trigger.
- **Trigger** `AFTER UPDATE OF status` em `error_reports` que insere uma linha em `error_report_history` com snapshot do nome via `profiles`.
- **Trigger** `AFTER INSERT` em `error_reports` que registra a transição inicial `null → aberto`.

### 2. Edge Functions (2 novas)

Ambas usam Lovable AI Gateway com `google/gemini-3-flash-preview` por padrão (LOVABLE_API_KEY já está no projeto).

- **`melhorar-texto-relato-erro`**
  - Input: `{ report_id }`. Lê `descricao`, `area` e info do reporter.
  - Saída: `{ texto_melhorado }`. Mantém o conteúdo original, só estrutura/clareza/termos técnicos. Não altera fatos.
  - Verifica permissão (chamador precisa ser admin de error_reports).

- **`gerar-prompt-correcao-erro`**
  - Input: `{ report_id }`. Lê descrição + área + lista de arquivos. Para imagens, gera signed URLs (1h) e envia ao modelo como conteúdo multimodal (`image_url`). Modelo padrão: `google/gemini-2.5-pro` (multimodal forte).
  - System prompt embute o **contexto do sistema** (stack: React 18 + Vite + Tailwind + Supabase; rota da área relatada; arquivos do projeto que tipicamente correspondem àquela área; convenções de RLS, uso do gateway, secrets, design tokens semânticos).
  - Output via tool calling estruturado: `{ titulo, contexto_resumido, passos_diagnostico[], arquivos_provaveis[], prompt_para_lovable }`. O `prompt_para_lovable` é o texto final pronto para colar.
  - Verifica permissão admin.

### 3. Frontend

- **`useErrorReports.ts`**: adicionar `descartado` ao tipo `ErrorReportStatus`; estender filtros (`reporterId?: string | null`, `dateFrom?: string`, `dateTo?: string`); novo hook `useDescartarErrorReport()`; novo hook `useErrorReportHistory(reportId)`; novo hook `useReportersList()` (distintos `reporter_id, reporter_nome` para o combobox).

- **`/diretoria/relatos-erros` (`RelatosErros.tsx`)** — refatorar com 3 abas no topo:
  1. **Fila** (default): cards agrupados por status (Aberto, Em tratamento, Concluído aguardando teste), ordenados por `created_at` asc (mais antigo primeiro = mais urgente). Cada card mostra: autor, área, idade ("há 2h"), preview de descrição, miniatura do 1º anexo se imagem.
  2. **Tabela** (a atual, mantida para listagem ampla com colunas).
  3. **Histórico**: tabela cronológica vinda de `error_report_history` (data, report (link), autor do relato, ator, transição `de → para`, observação). Filtrável por usuário e data.
  - Filtros globais (acima das abas): `Combobox de usuário`, `Date range picker`, busca livre, status (mantido como dropdown extra).

- **`DetalheRelatoModal.tsx`**:
  - Acima do textarea "Observação para o autor": botão **"Melhorar com IA"** (chama `melhorar-texto-relato-erro` com a descrição atual; substitui o conteúdo do textarea por sugestão; com toast de undo).
  - Nova seção **"Prompt de correção"**: botão **"Gerar prompt"** (chama `gerar-prompt-correcao-erro`); ao retornar exibe um bloco com o prompt em `<pre>`, botão "Copiar" e botões "Regerar" / "Editar manualmente".
  - Adicionar botão **"Descartar"** (vermelho outline) no footer com motivo opcional via prompt → chama `useDescartarErrorReport`.
  - Renomear "Marcar como concluído" → "Concluir e enviar para teste do usuário" para deixar explícito que volta ao autor.
  - Renderizar a timeline `error_report_history` no aside direito (substitui as 4 linhas estáticas atuais).

### 4. Permissões/Segurança

- Ambas edge functions: `verify_jwt = true` (Authorization Bearer do usuário) → validar via `is_error_reports_admin(auth.uid())` server-side antes de chamar IA. Retorna 403 se não for.
- Não armazenar prompts gerados na DB (são derivados; sob demanda).

## Fora do escopo

- Notificação por email/WhatsApp ao autor quando concluído (mantém o badge "Testar correções" que já existe).
- Categorização automática por área via IA.

## Validação esperada

- Diretor entra em /diretoria/relatos-erros → vê aba **Fila** por padrão com cards priorizados.
- Pode filtrar por usuário "Fulano" + período "última semana" e os 3 abas refletem.
- Abre modal → clica "Melhorar com IA" → texto da observação recebe versão polida.
- Clica "Gerar prompt" → recebe prompt pronto; copia e cola no Lovable.
- Pode "Iniciar tratamento", "Concluir e enviar para teste do usuário", "Descartar".
- Aba **Histórico** mostra todas as transições com data/ator/observação.
