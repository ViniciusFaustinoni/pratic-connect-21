

# Solicitações de Migração — Fila de Análise

## Resumo

Nova página `/cadastro/migracoes` no módulo Cadastro, acessível apenas para gerência/diretoria/admin. Lista todas as solicitações de migração com status, prazos, e painel lateral para análise e decisão (aprovar/reprovar).

## Banco de dados

### Migration SQL

1. **Tabela `migracao_decisoes_historico`** — registro imutável de cada decisão:
   - `id`, `solicitacao_id` (FK), `decisao` (aprovada/reprovada), `motivo`, `analista_id` (FK profiles), `created_at`
   - RLS: somente leitura para authenticated

2. **RLS na `solicitacoes_migracao`**: policy de UPDATE para roles com permissão `canManageCadastro` (gerência, diretoria, admin) — permitir alterar `status`, `aprovado_por`, `aprovado_em`, `motivo_reprovacao`

3. **RLS na `solicitacoes_migracao`**: policy de SELECT para authenticated (consultores veem as suas, gerência vê todas)

## Frontend

### 1. Nova página: `src/pages/cadastro/SolicitacoesMigracao.tsx`

- Guard: `usePermissions()` — requer `isGerencia || isDiretor || isAdminMaster || isDesenvolvedor`
- Query: `solicitacoes_migracao` com join em `documentos`, `profiles` (consultor)
- **Lista/tabela** com colunas: Nome, CPF, Placa, Associação Origem, Data Envio, Tempo Decorrido, Prazo Restante, Status, Consultor
- **Prazo restante**: calculado como `created_at + prazo_resposta_horas - now()`. Destaque amarelo/laranja < 4h, destaque vermelho quando vencido
- **Filtros**: por status (pendente/aprovada/reprovada/todos), ordenação padrão por prazo mais urgente
- Ao clicar em uma solicitação pendente, abre `Sheet` lateral com detalhes

### 2. Painel lateral (Sheet)

- Dados completos da solicitação
- **Abas (Tabs)**: uma aba por comprovante + aba "Boleto de Referência"
- Cada aba mostra o documento inline (imagem ou PDF via `<iframe>`/`<img>`)
- Resultado da validação automática por documento: CPF detectado, placa detectada, legível, erro
- Indicadores visuais de inconsistências (CPF/placa não batem)

### 3. Ações de decisão

- **Aprovar**: Dialog de confirmação simples → mutation:
  - Update `solicitacoes_migracao` com `status = 'aprovada'`, `aprovado_por`, `aprovado_em`
  - Insert em `migracao_decisoes_historico`
  - Insert notificação na tabela `notificacoes` para o `consultor_id`
  - Invalidar queries

- **Reprovar**: Dialog com textarea obrigatória para motivo → mutation:
  - Update `solicitacoes_migracao` com `status = 'reprovada'`, `motivo_reprovacao`
  - Insert em `migracao_decisoes_historico`
  - Insert notificação com motivo para o consultor

### 4. Hook: `src/hooks/useSolicitacoesMigracaoAdmin.ts`

- `useSolicitacoesMigracaoList(filtroStatus)` — lista todas com join
- `useAprovarMigracao()` — mutation de aprovação
- `useReprovarMigracao()` — mutation de reprovação

### 5. Integração no layout

- **`AppSidebar.tsx`**: adicionar item "Migrações" no grupo Cadastro (`/cadastro/migracoes`)
- **`App.tsx`**: adicionar `<Route path="/cadastro/migracoes" element={<SolicitacoesMigracao />} />`
- **`GlobalBreadcrumb.tsx`**: adicionar entrada para `/cadastro/migracoes`

## Valores dinâmicos

O prazo de resposta vem do campo `prazo_resposta_horas` de cada solicitação (que por sua vez foi preenchido via `useMigracaoConfig()` no momento da criação). Nenhum valor fixo.

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/cadastro/SolicitacoesMigracao.tsx` | Criar |
| `src/hooks/useSolicitacoesMigracaoAdmin.ts` | Criar |
| `src/App.tsx` | Adicionar rota |
| `src/components/layout/AppSidebar.tsx` | Adicionar item menu |
| `src/components/layout/GlobalBreadcrumb.tsx` | Adicionar breadcrumb |
| Migration SQL | Criar tabela histórico + RLS policies |

