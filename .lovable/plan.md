

# Plano: Página Unificada "Gestão Comercial" + Fix Edge Function

## Escopo

Duas entregas independentes:
1. **Fix crítico** na edge function `gerar-cobrancas-mensais` (valor errado R$150)
2. **Nova página unificada** `/diretoria/gestao-comercial` substituindo 3 abas separadas

---

## PARTE 1 — Fix `gerar-cobrancas-mensais`

**Arquivo:** `supabase/functions/gerar-cobrancas-mensais/index.ts`

Alterações cirúrgicas (sem remover lógica existente):

1. **Interface `Associado`** — substituir `planos.valor_mensalidade` por `contratos`
2. **Query** — adicionar `contratos!inner(id, valor_mensal, status)` com filtro `.eq('contratos.status', 'ativo')`
3. **Linha 136** — substituir `(associado.planos as any)?.valor_mensalidade || 150` por leitura de `contratos[0].valor_mensal` com validação e skip se inválido
4. **Array `erros`** — adicionar antes do loop, incluir no response final
5. **Deploy automático** após edição

---

## PARTE 2 — Nova página `GestaoComercial`

### Arquivos novos
| Arquivo | Função |
|---|---|
| `src/pages/diretoria/GestaoComercial.tsx` | Página principal com 3 tabs |
| `src/components/gestao-comercial/PageHeader.tsx` | Header com KPIs reais |
| `src/components/gestao-comercial/TabNavigation.tsx` | Tabs com indicador animado |
| `src/components/gestao-comercial/ProdutosPlanos.tsx` | Tab 1 — sidebar de planos + detalhe |
| `src/components/gestao-comercial/BeneficiosCoberturas.tsx` | Tab 2 — duas colunas |
| `src/components/gestao-comercial/TabelaPrecosTab.tsx` | Tab 3 — tabela com filtro por plano |

### Reutilização de componentes existentes
- Modais: `PlanFormModal`, `BeneficioFormModal`, `CoberturaFormModal`, `LinhaFormModal`, `FaixaPrecoModal`, `HistoricoPrecoModal`, `ProdutoFormModal`, `VincularCoberturaModal`
- Hooks: `usePlans`, `useProductLines`, `useBenefits`, `useMainCoverages` de `usePlans.ts`
- Hooks admin: `useDeletePlan`, `useDuplicatePlan`, `useDeleteBenefit`, `useUpdateBenefit` de `usePlansAdmin.ts`

### Design
- Paleta dark premium conforme especificado (bg `#0a0f1e`, cards `#111827`, accent blue `#3b82f6`)
- Font DM Sans via `@import` no `index.css`
- Tabs com `border-b-2` animado, não boxed
- Cards `rounded-xl border border-[#1e2d45]`

### Tab 1 — Produtos & Planos
- Layout master-detail: lista de planos à esquerda (filtrada por product_line), painel de detalhe à direita
- Seletor de linhas de produto no topo (reutiliza pattern de `PlanosTab`)
- Sub-tabs no detalhe: **Faixas de Preço** (via `plano_preco_map` → `tabelas_preco_mensalidade`), **Coberturas** (via `planos_coberturas`), **Detalhes** (campos do plano)
- Query enriquecida com `associados(count)`, `plano_preco_map(linha_slug)`, `planos_coberturas(coberturas(nome, descricao, limite_valor))`

### Tab 2 — Benefícios & Coberturas
- Duas colunas lado a lado
- Coluna esquerda: `benefits` com join em `planos_beneficios → planos(nome)`
- Coluna direita: `main_coverages` (coberturas de marketing/display)
- Filtro por plano em cada coluna
- Botões editar/remover reutilizando modais existentes

### Tab 3 — Tabela de Preços
- Reusa a lógica atual de `TabelaPrecos.tsx` (filtros, import/export CSV, CRUD)
- **Novo**: filtro por plano via `plano_preco_map`
- **Novo**: coluna "Planos vinculados" mostrando quais planos usam cada `linha_slug`

### KPIs no header (dados reais)
- Planos ativos: `COUNT(planos WHERE ativo=true)`
- Associados cobertos: `COUNT(associados WHERE status='ativo')`
- Faixas de preço: `COUNT(tabelas_preco_mensalidade WHERE is_active=true)`
- Benefícios cadastrados: `COUNT(benefits WHERE is_active=true)`

### Alterações em arquivos existentes

| Arquivo | Alteração |
|---|---|
| `src/App.tsx` | Adicionar rota `/diretoria/gestao-comercial` → `GestaoComercial` |
| `src/components/layout/AppSidebar.tsx` | Substituir 3 itens (Produtos, Planos/Benefícios, Tabela de Preços) por 1 item "Gestão Comercial" com ícone `Layers` |
| `src/components/layout/GlobalBreadcrumb.tsx` | Adicionar entrada para nova rota |
| `src/index.css` | Adicionar `@import` do DM Sans |

As 3 rotas antigas (`/diretoria/produtos`, `/diretoria/planos-beneficios`, `/diretoria/precos`) serão mantidas como redirects para a nova página.

