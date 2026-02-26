

# Correcao: Consultores nao mostrando cotacoes

## Problema
O hook `usePropostasMetricas.ts` calcula as metricas dos consultores usando apenas as tabelas `leads` e `contratos`. A tabela `cotacoes` nunca e consultada. Quando um vendedor cria uma cotacao diretamente (sem lead vinculado, ou seja, `lead_id = null`), essa cotacao nao aparece nas metricas da aba Consultores.

## Causa Raiz
- `emCotacao` conta `leads` com `etapa === 'cotacao_enviada'` — ignora cotacoes sem lead
- `contratoEnviado` conta `leads` com `etapa === 'contrato_enviado'` — mesmo problema
- Nenhuma metrica consulta a tabela `cotacoes` para contar cotacoes reais

## Solucao

### Arquivo: `src/hooks/usePropostasMetricas.ts`

1. **Adicionar query a tabela `cotacoes`**: Buscar todas as cotacoes dos vendedores no periodo, filtrando por `vendedor_id` (que armazena `auth.users.id`).

2. **Incorporar contagens de cotacoes nas metricas**:
   - `emCotacao`: Contar cotacoes com status `rascunho` ou `enviada` (cotacoes ativas que ainda nao foram aceitas/recusadas). Usar o MAIOR valor entre a contagem de leads e a contagem de cotacoes reais.
   - Adicionar campo `cotacoesRealizadas` ao `ConsultorMetricas` para mostrar o total de cotacoes feitas pelo vendedor no periodo.

3. **Atualizar metricas globais**: Incluir cotacoes reais na contagem global de `emCotacao`.

### Detalhes tecnicos

```text
Query adicionada:
  supabase.from('cotacoes')
    .select('id, vendedor_id, status, valor_total_mensal, created_at')
    .in('vendedor_id', vendedorIds)

Mapeamento por vendedor:
  - cotacoes com status 'rascunho' ou 'enviada' -> emCotacao
  - cotacoes com status 'aceita' -> contabilizar como negociacao
  - total de cotacoes no periodo -> cotacoesRealizadas (novo campo)
```

### Interface `ConsultorMetricas`
- Adicionar campo opcional `cotacoesRealizadas: number` para exibir o total de cotacoes criadas

### Componentes de exibicao
- `ConsultoresTable.tsx`: A coluna "Cotacao" ja exibe `consultor.emCotacao`, entao ao corrigir o valor no hook, a tabela atualiza automaticamente.
- Nenhuma alteracao necessaria nos componentes de UI.

## Arquivos alterados
1. `src/hooks/usePropostasMetricas.ts` — Adicionar query de cotacoes e incorporar nas metricas

## O que NAO muda
- Logica de leads e contratos existente
- Componentes visuais (ConsultoresTable, ConsultorCard, etc)
- Ordenacao e ranking dos consultores

