

# Plano: Unificar Pré-Análise e Solicitações IA

## Contexto

Existem duas páginas separadas que tratam de itens em estágio inicial:
- **Pré-Análise** (`EventosPreAnalise.tsx`): sinistros com status `comunicado`, `documentacao_pendente`, `aguardando_vistoria`
- **Solicitações IA** (`SolicitacoesIA.tsx`): registros de `chat_solicitacoes_ia` pendentes de aprovação

A ideia é juntar tudo em **Pré-Análise**, com badges indicando a origem: **IA** (chat) ou **App** (sistema/manual).

## Alterações

### 1. `EventosPreAnalise.tsx` — Reformular com duas fontes de dados

- **Query 1**: Sinistros em pré-análise (já existente) — marcados com badge "App"
- **Query 2**: `chat_solicitacoes_ia` com status `pendente` — marcados com badge "IA"
- Mesclar ambos em uma lista unificada, ordenada por `created_at` desc
- Adicionar coluna **Origem** na tabela com badges coloridos:
  - `IA` → badge roxo/azul com ícone Bot
  - `App` → badge cinza/verde
- Adicionar filtro de origem (Todos / IA / App)
- Para itens de origem IA: ao clicar na linha, abrir dialog de aprovação/rejeição (reutilizar lógica do `SolicitacoesIA.tsx` — mutation `aprovar-solicitacao-ia`, botões Aprovar/Rejeitar, campo motivo)
- Para itens de origem App (sinistros): manter comportamento atual (navegar para detalhe)

### 2. `AppSidebar.tsx` — Remover "Solicitações IA" do menu Eventos

Remover a linha `{ title: 'Solicitações IA', url: '/eventos/solicitacoes-ia', icon: Bot }`.

### 3. `modules.ts` — Remover sub-item `solicitacoes_ia` do módulo eventos

### 4. Manter rota `/eventos/solicitacoes-ia` no App.tsx

Redirecionar para `/eventos/pre_analise` para não quebrar links existentes.

## Arquivos alterados
- `src/pages/eventos/EventosPreAnalise.tsx` — adicionar query de solicitações IA, merge, badges, dialog de aprovação
- `src/components/layout/AppSidebar.tsx` — remover item do menu
- `src/config/modules.ts` — remover `solicitacoes_ia` de eventos

