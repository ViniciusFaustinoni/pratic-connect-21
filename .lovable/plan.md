

# Revisão Completa dos Tipos de Entrada no Sistema

## Análise de todos os fluxos

Verifiquei como cada tipo de entrada é salvo no banco:

| Tipo | Onde é definido | Valor salvo | Status |
|---|---|---|---|
| Nova adesão | `contrato-gerar/index.ts` L644 | `'nova'` (fallback) | **Problema** — deveria ser `'adesao'` |
| Migração | Cotação com `tipo_entrada = 'migracao'` | `'migracao'` | OK |
| Inclusão veículo | `Cotador.tsx` define `'inclusao'` | `'inclusao'` | OK |
| Troca titularidade | `efetivar-troca-titularidade` | `'troca_titularidade'` | OK |
| Reativação | `ReativacaoWizard.tsx` | `'reativacao'` | OK |
| Substituição placa | `efetivar-substituicao` | `'substituicao_placa'` | OK |

## Problemas restantes

### 1. `contrato-gerar/index.ts` — Fallback ainda é `'nova'`
Linha 644: `cotacao.tipo_entrada || 'nova'` — novos contratos sem tipo definido continuam salvando `'nova'`.

### 2. `contrato-gerar/index.ts` — Carência ignora `'adesao'`
Linha 659: `['nova', 'inclusao'].includes(tipoEntrada)` — se a cotação vier com `tipo_entrada = 'adesao'` (valor correto), a carência **não será aplicada**.

### 3. Migration — DEFAULT da coluna `contratos.tipo_entrada`
O default no banco é `'nova'`. Deve ser `'adesao'`. E registros existentes com `'nova'` devem ser atualizados.

## Correções

### `supabase/functions/contrato-gerar/index.ts`
- **Linha 644**: Mudar fallback para `'adesao'`
- **Linha 659**: Incluir `'adesao'` na lista de carência: `['adesao', 'nova', 'inclusao']`

### Migration SQL
```sql
ALTER TABLE public.contratos ALTER COLUMN tipo_entrada SET DEFAULT 'adesao';
```

### Data update (via insert tool)
```sql
UPDATE contratos SET tipo_entrada = 'adesao' WHERE tipo_entrada = 'nova';
```

## Template e normalização (já OK)
- `template-utils.ts` — já aceita `'nova'` e `'adesao'` para `operacao.adesao`
- `termo-afiliacao-utils.ts` — já normaliza `'nova'` → `'adesao'`
- Todos os outros 5 tipos (`migracao`, `inclusao`, `troca_titularidade`, `reativacao`, `substituicao_placa`) já mapeiam corretamente no template

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/contrato-gerar/index.ts` | Fallback `'nova'` → `'adesao'`; incluir `'adesao'` na condição de carência |
| Migration SQL | Alterar DEFAULT da coluna `tipo_entrada` |
| Data update | Atualizar registros existentes `'nova'` → `'adesao'` |

