

# Exibir Carência por Benefício e Cobertura na Ficha do Associado

## Contexto
O card "Carência" na ficha do associado mostra apenas a carência **geral do contrato** (datas de início/fim). O pedido é que, quando coberturas ou benefícios do plano do associado tiverem `carencia_ativa = true` configurada no catálogo, essas carências individuais também sejam exibidas, calculando as datas a partir da `data_carencia_inicio` do contrato.

## Solução

### 1. `src/hooks/useAssociadoSituacao.ts` — Buscar carências por item do plano

- Adicionar query que busca o `plano_id` do associado e depois faz JOIN de `planos_beneficios → benefits` e `planos_coberturas → coberturas` filtrando por `carencia_ativa = true`
- Para cada item, calcular `inicio` (= `data_carencia_inicio` do contrato) e `fim` (= inicio + `carencia_dias` dias)
- Retornar array `carenciasItens` no `SituacaoAssociado`:
  ```ts
  { nome: string; tipo: 'cobertura' | 'beneficio'; carenciaTipo: string; dias: number; multiplicador?: number; inicio: string; fim: string; emCarencia: boolean }[]
  ```

### 2. `src/components/associados/detalhe/AssociadoSituacaoCard.tsx` — Renderizar carências por item

- Abaixo da carência geral existente, se `situacao.carenciasItens.length > 0`, listar cada item com:
  - Ícone diferenciado (Shield para cobertura, Gift para benefício)
  - Nome do item
  - Tipo de carência: "Liberação" ou "Multiplicadora (Nx)"
  - Dias e datas
  - Badge "Em carência" ou "Concluída"

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/hooks/useAssociadoSituacao.ts` | Buscar itens do plano com carência ativa + calcular datas |
| `src/components/associados/detalhe/AssociadoSituacaoCard.tsx` | Renderizar lista de carências por item |

