

## Visibilidade do botão de menu + Funil filtrado por consultor

### 1. Ícone do menu (SidebarTrigger) mais visível

Hoje em `src/components/layout/AppHeader.tsx:37` o trigger usa `text-muted-foreground` (cinza fraco) e `<PanelLeft />` em tamanho padrão dentro de `h-7 w-7` — quase invisível em mobile contra o fundo escuro do header.

**Mudanças em `src/components/layout/AppHeader.tsx`:**
- Trocar variant ghost discreto por um botão de contraste alto:
  - Adicionar `border border-border bg-card-hover` para criar moldura visível.
  - Trocar cor para `text-foreground` (não `muted-foreground`).
  - Aumentar ícone para `h-5 w-5` via classe filha (override no SidebarTrigger por estilo já permitido).
- Adicionar um pequeno indicador visual de estado (quando colapsado, um traço acentuado) usando o estado `state` do `useSidebar`.
- Manter área de toque 44×44 já existente.

Resultado: ícone branco com contorno claro, claramente clicável tanto em dark quanto mobile.

### 2. Funil de Cotação filtrado pelo consultor logado

**Diagnóstico.** `useFunilCotacao` (`src/hooks/useFunilCotacao.ts`) consulta `leads`, `cotacoes`, `contratos`, `instalacoes`, `associados` **sem nenhum filtro de `vendedor_id`**. Resultado: vendedor externo vê números globais da empresa (1000 propostas, etc.), idêntico ao screenshot.

Todas as tabelas envolvidas já têm a coluna `vendedor_id` (confirmado em `types.ts` e em `useNewLeadFlow`, `ContratoFormDialog`, `useLeads`). `instalacoes` e `associados` não têm `vendedor_id` direto — precisam ser ligadas por `cotacao_id`/`contrato_id`.

**Princípio.** Quando o usuário logado for **vendedor** (`isVendedorClt` ou `isVendedorExterno`) e **NÃO for gestor** (não diretor/gerente/supervisor/admin), o funil filtra por `vendedor_id = profile.id`. Para gestores e diretoria, comportamento atual (visão total) é mantido.

**Mudanças:**

**A. `src/hooks/useFunilCotacao.ts`**
- Receber `vendedorId?: string | null` como parâmetro opcional, ou deduzir internamente via `useAuth` + `usePermissions`:
  - Se `(isVendedorClt || isVendedorExterno) && !isGestor` → aplicar filtro `vendedor_id = profile.id` em `leads`, `cotacoes`, `contratos`.
  - Para `instalacoes` e `associados`: filtrar via subquery — buscar IDs de cotações/contratos do vendedor e usar `.in('cotacao_id', …)` / `.in('contrato_id', …)`.
- Adicionar `vendedorId` na `queryKey` para cache correto por usuário.

**B. `src/components/vendas/FunilCotacaoChart.tsx`**
- Aceitar prop opcional `vendedorId` e repassar para o hook. Sem prop = usa lógica automática do hook (vendedor logado).

**C. `src/pages/Dashboard.tsx`**
- Nenhuma mudança necessária — `<FunilCotacaoChart periodo="30dias" />` continua igual; o hook se ajusta sozinho conforme o role.

**D. `src/pages/vendas/VendasDashboard.tsx`**
- Mesma coisa: o `<FunilCotacaoChart periodo={periodo} />` da linha 383 continua sem prop, mas como essa página já é por consultor (e gestores veem total), o hook decide sozinho. Comportamento idêntico para gestor; correto para vendedor.

### Arquivos editados

- `src/components/layout/AppHeader.tsx` — destacar SidebarTrigger.
- `src/hooks/useFunilCotacao.ts` — filtro automático por `vendedor_id` quando vendedor logado.
- `src/components/vendas/FunilCotacaoChart.tsx` — aceitar prop opcional `vendedorId` (futuro override por gestor).

### O que NÃO muda

- Visão de gestores (diretor/gerente/supervisor/admin) e diretoria continua agregada (sem filtro).
- KPIs de “Minhas Comissões” já são por vendedor (via `useMinhasComissoes*`) — sem alteração.
- Outros dashboards específicos (analista cadastro/eventos/monitoramento) não usam `FunilCotacaoChart`.

### Riscos

- Subquery `instalacoes`/`associados` por `IN (cotacoes_do_vendedor)` pode trazer 0 resultados em vendedor novo — esperado, exibe “0”.
- Se algum vendedor tem cotações antigas migradas sem `vendedor_id`, elas ficam fora do funil dele (correto: não foram dele formalmente). Sem backfill no escopo desta tarefa.
- Nenhum impacto em RLS — todas essas tabelas já têm RLS que permite vendedor ver suas próprias linhas; o filtro adiciona precisão, não permissão.

