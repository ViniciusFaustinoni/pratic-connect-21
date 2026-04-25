## Objetivo

Tirar a página "Venda Externa" do módulo Financeiro e transformá-la em uma aba do Dashboard de Comissões.

## Mudanças

### 1. Dashboard de Comissões vira `Tabs`
`src/pages/comissoes/Dashboard.tsx` passa a renderizar um `<Tabs>` com duas abas:

- **Visão Geral** — todo o conteúdo atual (filtros, KPIs, Top 5, modal de detalhes), sem alterações funcionais.
- **Venda Externa** — renderiza `<DashboardVendaExterna />` como componente embutido.

A aba ativa é controlada por query string (`?tab=venda-externa`) para permitir deep-link a partir da sidebar.

### 2. Mover o arquivo da página
- `src/pages/financeiro/DashboardVendaExterna.tsx` → `src/pages/comissoes/VendaExterna.tsx`
- `src/pages/financeiro/GestaoContaVendedor.tsx` → `src/pages/comissoes/GestaoContaVendedor.tsx`

Ajustar o `navigate(...)` interno do dashboard de venda externa (linha 190): em vez de ir para `/financeiro/venda-externa/:vendedorId`, navegar para `/comissoes/venda-externa/:vendedorId`.

`ComissionamentoExternoConfig.tsx` permanece onde está (não foi pedido para mover) — já tem redirect via `<Navigate>` de `/financeiro/configuracoes/comissionamento-externo` para `/comissoes`.

### 3. Rotas (`src/App.tsx`)
- Remover do bloco financeiro:
  ```
  <Route path="/financeiro/venda-externa" element={<DashboardVendaExterna />} />
  <Route path="/financeiro/venda-externa/:vendedorId" element={<GestaoContaVendedor />} />
  ```
- Adicionar redirects para preservar links antigos:
  ```
  <Route path="/financeiro/venda-externa" element={<Navigate to="/comissoes?tab=venda-externa" replace />} />
  <Route path="/financeiro/venda-externa/:vendedorId" element={<RedirectVendaExterna />} />
  ```
  (`RedirectVendaExterna` lê `useParams` e faz `<Navigate to={`/comissoes/venda-externa/${vendedorId}`} replace />`).
- Adicionar dentro do bloco `/comissoes`:
  ```
  <Route path="/comissoes/venda-externa/:vendedorId" element={<GestaoContaVendedor />} />
  ```
  (a aba dentro do dashboard cobre `/comissoes?tab=venda-externa`; rota dedicada só para o detalhe por vendedor.)
- Atualizar imports lazy dos dois componentes para o novo caminho.

### 4. Sidebar (`src/components/layout/AppSidebar.tsx`)
- Remover linha 304 (`Venda Externa` do grupo Financeiro).
- Adicionar dentro do grupo `comissoes` (após o Dashboard):
  ```
  { title: 'Venda Externa', url: '/comissoes?tab=venda-externa', icon: Users },
  ```

### 5. Breadcrumb (`src/components/layout/GlobalBreadcrumb.tsx`)
- Remover entrada `/financeiro/venda-externa`.
- Adicionar `/comissoes/venda-externa/:vendedorId` se necessário (a página filha continua tendo seu próprio header).

### 6. Limpeza visual no componente embutido
Quando `DashboardVendaExterna` rodar dentro da aba, o `<h1>Venda Externa</h1>` duplica o título do Dashboard de Comissões. Solução: aceitar uma prop opcional `embedded?: boolean` no componente; quando `true`, omite o header `h1+p` (mantém o botão "Exportar relatório" no canto direito da aba).

## Arquivos afetados

**Editados:**
- `src/App.tsx` — rotas removidas/adicionadas + redirects
- `src/components/layout/AppSidebar.tsx` — mover item entre grupos
- `src/components/layout/GlobalBreadcrumb.tsx` — atualizar mapeamento
- `src/pages/comissoes/Dashboard.tsx` — adicionar Tabs e integrar venda externa

**Movidos (renomeados):**
- `src/pages/financeiro/DashboardVendaExterna.tsx` → `src/pages/comissoes/VendaExterna.tsx` (com prop `embedded`)
- `src/pages/financeiro/GestaoContaVendedor.tsx` → `src/pages/comissoes/GestaoContaVendedor.tsx`

Sem mudanças no banco, hooks (`useDashboardVendaExterna`) ou edge functions.

## Validação

Acessar como diretor:
- `/financeiro` → item "Venda Externa" não aparece mais no menu Financeiro.
- `/comissoes` → menu Comissões inclui "Venda Externa" abaixo do Dashboard.
- Dashboard de Comissões mostra duas abas; clicar em "Venda Externa" carrega a tabela de vendedores.
- `/financeiro/venda-externa` (link antigo) redireciona para `/comissoes?tab=venda-externa`.
- "Ver extrato" de um vendedor abre `/comissoes/venda-externa/:id` corretamente.
