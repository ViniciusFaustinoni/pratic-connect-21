

# Auditoria: Filtragem de Planos na Cotação — Diagnóstico e Plano

## O que funciona corretamente

| Filtro | Mecanismo | Status |
|--------|-----------|--------|
| Aplicativo vs Passeio | `usoApp` → filtra por `tipo_uso` do plano | OK |
| Moto vs Carro | `tipoVeiculo` → filtra por `vehicle_type` do product_line | OK |
| Ano mínimo | `anoMinimo` do plano vs ano do veículo | OK |
| Faixa FIPE | `fipe_minima`/`fipe_maxima` do plano | OK |
| Ano recente (Lançamento) | `requires_recent_year` do product_line | OK |
| Preço mensal por região/combustível | `tabelas_preco_mensalidade` via `plano_preco_map` | OK |
| Coberturas removidas por categoria | `benefit_category_exclusions` → exibe alerta | OK |

## Problema encontrado

**Categorias de deságio (leilão, chassi remarcado, ressarcimento integral, táxi, ex-táxi, placa vermelha) não filtram planos com 100% FIPE.**

A regra de negócio diz: veículos nestas categorias são proibidos de contratar planos com 100% da FIPE (Select, Select One, Lançamento). Só podem contratar Especial (80% FIPE).

Hoje o `usePlanosCotacao` recebe o parâmetro `categoria` mas **nunca o usa para filtrar planos** — só para ajustar cota e listar coberturas removidas. Um veículo de leilão vê todos os 15 planos, incluindo Select e Lançamento.

## Solução proposta

Adicionar uma coluna `blocked_categories` (text array) na tabela `product_lines` para configurar quais categorias de veículo são bloqueadas por linha de produto. O filtro será aplicado no hook `usePlanosCotacao`.

### Fase 1: Migração — adicionar coluna e popular dados

```sql
ALTER TABLE product_lines ADD COLUMN blocked_categories text[] DEFAULT '{}';

-- Select e Select One: bloqueiam categorias de risco/depreciação
UPDATE product_lines SET blocked_categories = ARRAY['leilao','chassi_remarcado','ressarcimento_integral','taxi','ex_taxi','placa_vermelha']
WHERE slug IN ('select', 'select-one');

-- Lançamento: mesmas restrições
UPDATE product_lines SET blocked_categories = ARRAY['leilao','chassi_remarcado','ressarcimento_integral','taxi','ex_taxi','placa_vermelha']
WHERE slug = 'lancamento';

-- Especial, Advanced, Elétrico: sem restrição (array vazio = aceita tudo)
```

### Fase 2: Aplicar filtro no hook

**Arquivo**: `src/hooks/usePlanosCotacao.ts`

Após os filtros existentes (uso, tipo veículo, ano, FIPE), adicionar:

```typescript
// Filtrar por categoria bloqueada no product_line
const blockedCategories: string[] = plProductLine?.blocked_categories || [];
if (categoria && categoria !== 'nenhuma' && categoria !== 'aplicativo' 
    && blockedCategories.includes(categoria)) {
  continue;
}
```

Isso fará com que, ao selecionar "leilão" na etapa de critérios, os planos Select/Lançamento desapareçam automaticamente, mostrando apenas Especial.

### Fase 3: Expor blocked_categories na query de planos

A query existente no hook já faz `select(*, product_lines:product_line_id(...))`. Basta adicionar `blocked_categories` ao select do join.

## Resumo de arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL | Adicionar `blocked_categories` em `product_lines` |
| `src/hooks/usePlanosCotacao.ts` | Adicionar filtro por `blocked_categories` |

Correção cirúrgica — 1 migração + ~5 linhas de código no hook.

