

# Auditoria Completa: Criação e Gestão de Planos — Parte 1

## Estado Atual do Banco de Dados

### Linhas de Produto (product_lines) — 6 linhas ativas
| Linha | Slug | Tipo Veículo | Cor |
|-------|------|-------------|-----|
| Linha Select | select | car | green |
| Linha Select One | select-one | car | emerald |
| Linha Especial | especial | car | orange |
| Linha Lançamento | lancamento | car | purple |
| Linha Advanced (Motos) | advanced | motorcycle | red |
| Linha Elétrico | eletrico | car | #10B981 |

### Planos Ativos — 15 planos
- **Select**: Basic, Premium, Exclusive, Exclusive Aplicativo
- **Select One**: Select One, Select One Aplicativo
- **Especial**: Especial, Especial Plus
- **Lançamento**: Basic, Premium, Exclusive, Exclusive Aplicativo
- **Advanced**: Advanced, Advanced+
- **Elétrico**: Elétricos

Todos os 15 planos possuem benefícios (3-15), coberturas (3-11) e mapeamento de preços (`plano_preco_map`) configurados.

### Tabela de Preços (tabelas_preco_mensalidade)
Segmentada por: `linha_slug`, `regiao` (sp/rj/lagos), `tipo_uso` (particular/aplicativo/advanced/advanced-plus), `combustivel_tipo` (gasolina/diesel/null).

---

## Problemas Identificados

### 1. Existem 3 interfaces de gestão de planos diferentes e dessincronizadas

| Interface | Rota | Modal de Criação | Campos | Problema |
|-----------|------|-------------------|--------|----------|
| **PlanosAdmin** | /admin/planos | `PlanFormModal` | Completo (cotas, benefícios, badge, slug, product_line) | Funcional, mas usa aliases (name↔nome) |
| **Gestão Comercial** | /diretoria/gestao-comercial | `ProdutoFormModal` | Básico (código, FIPE min/max, tipo veículo, uso) | **Não salva** product_line_id, cotas, slug, badge, coverage_type |
| **ProdutosGestao** | /diretoria/produtos | `ProdutoFormModal` | Idem acima | Mesma modal defasada |

**Impacto**: Se o diretor criar/editar um plano pela Gestão Comercial, o plano fica sem `product_line_id`, sem cotas, sem slug — e não aparece na listagem correta nem no fluxo de cotação.

### 2. `ProdutoFormModal` está completamente defasada
Essa modal opera sobre campos legados (`tipo_veiculo`, `uso`, `fipe_minima`, `fipe_maxima`, `ano_fabricacao_minimo`) que não são os campos usados pelo sistema real (`product_line_id`, `tipo_uso`, `cota_participacao`, `ano_minimo`, `coverage_type`, etc.).

### 3. Campos críticos ausentes no formulário de criação
Conforme a regra de negócio descrita, ao criar um plano o diretor precisa definir:
- ✅ Nome comercial → `nome`
- ✅ Linha do plano → `product_line_id` (só no PlanFormModal)
- ❌ **Categorias de veículo aceitas** → não existe campo no formulário nem na tabela (implícito via product_lines.vehicle_type, mas sem granularidade)
- ✅ Cota de participação por categoria → `cota_participacao`, `cota_app_percent` (só no PlanFormModal)
- ✅ Valor mínimo de cota → `cota_minima`, `cota_app_min` (só no PlanFormModal)
- ✅ Coberturas incluídas → via `planos_coberturas` (gerenciado separadamente na Gestão Comercial)
- ❌ **Tabela de preços vinculada** → `plano_preco_map` não é configurável por nenhum formulário (inserido manualmente no banco)

### 4. `plano_preco_map` não tem UI de gestão
O mapeamento plano→linha_slug_preço é feito direto no banco. O diretor não consegue vincular um plano a uma tabela de preços pela interface.

---

## Plano de Implementação

### Fase 1: Unificar o modal de criação/edição de planos

Substituir o `ProdutoFormModal` defasado pelo `PlanFormModal` já funcional em todas as 3 interfaces.

**Arquivos a alterar:**
- `src/components/gestao-comercial/ProdutosPlanos.tsx` — trocar `ProdutoFormModal` por `PlanFormModal`
- `src/pages/diretoria/ProdutosGestao.tsx` — idem
- `src/pages/diretoria/ProdutoDetalhe.tsx` — idem

**Adaptação necessária:**
- O `PlanFormModal` usa `PlanWithDetails` como tipo de entrada, então precisamos mapear o plano selecionado (que vem do `usePlans`) para esse formato antes de passar ao modal — isso já funciona na Gestão Comercial pois já usa `usePlans`.

### Fase 2: Adicionar gestão do `plano_preco_map` ao formulário

Permitir que o diretor vincule o plano a uma `linha_slug` de preço diretamente pelo formulário.

**Alterações:**
- `src/components/admin/planos/PlanFormModal.tsx` — adicionar campo Select para escolher `linha_slug` da tabela de preços (buscar slugs distintos de `tabelas_preco_mensalidade`)
- `src/hooks/usePlansAdmin.ts` — no `useCreatePlan` e `useUpdatePlan`, após salvar o plano, fazer upsert em `plano_preco_map`

### Fase 3: Adicionar campo "Categorias de Veículo Aceitas"

O formulário precisa de um multi-select para definir quais categorias de veículo o plano aceita (passeio, aplicativo, diesel, leilão, etc.). Isso já está parcialmente coberto pelo campo `tipo_uso` e pela lógica de `benefit_category_exclusions`, mas falta um campo explícito no plano.

**Opção pragmática**: Usar o campo `categoria` (varchar, já existe na tabela `planos`) para armazenar as categorias aceitas como texto delimitado, e adicionar um multi-select ao `PlanFormModal`.

### Fase 4: Limpar código legado

- Remover `ProdutoFormModal` após migração completa
- Remover hooks duplicados (`usePlanosAdmin.ts`, `usePlanosUnificados.ts`) que operam sobre a mesma tabela mas com tipos diferentes
- Consolidar `usePlanos.ts` e `usePlans.ts` — manter apenas `usePlans.ts` como fonte única

---

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/gestao-comercial/ProdutosPlanos.tsx` | Trocar ProdutoFormModal → PlanFormModal |
| `src/pages/diretoria/ProdutosGestao.tsx` | Trocar ProdutoFormModal → PlanFormModal |
| `src/pages/diretoria/ProdutoDetalhe.tsx` | Trocar ProdutoFormModal → PlanFormModal |
| `src/components/admin/planos/PlanFormModal.tsx` | Adicionar campo `linha_slug` (preços) e categorias de veículo |
| `src/hooks/usePlansAdmin.ts` | Adicionar upsert em `plano_preco_map` no create/update |
| `src/components/diretoria/ProdutoFormModal.tsx` | Remover (substituído) |
| `src/hooks/usePlanosAdmin.ts` | Marcar como deprecated / remover |
| `src/hooks/usePlanosUnificados.ts` | Marcar como deprecated / remover |

