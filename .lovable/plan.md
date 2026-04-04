

# Mostrar Carência Real de Cada Cobertura e Benefício

## Diagnóstico

O contrato do associado tem carência geral registrada (02/04/2026 a 31/07/2026 = ~120 dias), porém **nenhum** item do plano (coberturas e benefícios) tem `carencia_ativa = true` no catálogo. O código atual só exibe itens na seção "Carências por item" quando `carencia_ativa = true`, resultando na lista vazia.

O card mostra apenas as datas gerais do contrato, sem detalhar quais coberturas/benefícios estão sob carência.

## Proposta

Quando o contrato tiver carência geral (datas início/fim), mostrar **todos** os itens do plano (coberturas e benefícios) com a carência do contrato aplicada. Itens que tiverem `carencia_ativa = true` no catálogo usam seus dias específicos (override individual); os demais herdam o período geral do contrato.

## Alteração

### `src/hooks/useAssociadoSituacao.ts`

1. Adicionar query para buscar **todas** coberturas e benefícios do plano (não só as com `carencia_ativa = true`)
2. Na construção de `carenciasItens`:
   - Se o item tem `carencia_ativa = true` e `carencia_dias > 0`: usar os dias específicos do catálogo
   - Senão: usar o período geral do contrato (`data_carencia_inicio` → `data_carencia_fim`)
3. Cada item terá `emCarencia` calculado individualmente com base na sua data de fim

```text
Exemplo resultado:
┌──────────────────────────────────────────────────────────────┐
│ 🛡️ Colisão - Select    · Liberação   120d  até 31/07/2026  │
│ 🛡️ Roubo - Select      · Liberação   120d  até 31/07/2026  │
│ 🛡️ Furto - Select      · Liberação   120d  até 31/07/2026  │
│ 🎁 Assistência 24h     · Liberação   120d  até 31/07/2026  │
│ 🎁 Carro Reserva       · Multiplicadora (2x) 90d até 01/07 │
└──────────────────────────────────────────────────────────────┘
```

### Detalhes técnicos

**`useAssociadoSituacao.ts`** — Queries de carência (linhas ~101-144):
- Remover filtro `.eq('benefits.carencia_ativa', true)` e `.eq('coberturas.carencia_ativa', true)`
- Buscar todos os itens do plano com seus campos de carência

**`useAssociadoSituacao.ts`** — Construção de `carenciasItens` (linhas ~201-215):
- Para cada item:
  - Se `carencia_ativa && carencia_dias > 0`: `fim = inicio + carencia_dias`
  - Senão: `fim = contrato.data_carencia_fim` (período geral)
  - `dias = diferença em dias entre inicio e fim`
  - `carenciaTipo`: do catálogo se `carencia_ativa`, senão `'liberacao'`

## Impacto
- 1 arquivo alterado (`useAssociadoSituacao.ts`)
- 0 componentes alterados (a UI já renderiza `carenciasItens` corretamente)
- 0 migrations

