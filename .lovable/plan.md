

# Novos Graficos e Tabela Resumo no Dashboard Financeiro

## Resumo

Adicionar 4 novos componentes visuais ao Dashboard Financeiro existente (`FinanceiroDashboard.tsx`):

1. **Receita vs Despesa 12 meses** -- grafico de barras agrupadas
2. **Composicao de Receitas e Despesas** -- dois graficos donut lado a lado
3. **Inadimplencia por Idade** -- barras horizontais por faixa de atraso
4. **Tabela Resumo do Mes** -- previsto vs realizado com desvio percentual

## Arquivos a Criar

### 1. `src/components/financeiro/ReceitaDespesa12MesesChart.tsx`

Grafico de barras agrupadas (recharts `BarChart`) mostrando receita e despesa mensais dos ultimos 12 meses.

**Dados:**
- Receitas: `asaas_cobrancas` com status `RECEIVED/CONFIRMED/pago`, agrupadas por mes de `pagamento_data`
- Despesas: `contas_pagar` com status `pago`, agrupadas por mes de `data_pagamento`
- Eixo X: meses (Jan, Fev, Mar...)
- Barras verdes para receita, vermelhas para despesa
- Linha de saldo (receita - despesa) opcional

**Query:** Buscar todos os registros dos ultimos 12 meses em duas queries paralelas e agrupar no frontend com `useMemo`.

### 2. `src/components/financeiro/ComposicaoReceitaDespesaChart.tsx`

Dois graficos donut (recharts `PieChart`) lado a lado:

**Donut de Receita** -- agrupa `asaas_cobrancas` por campo `tipo` (mensalidade, adesao, taxa_vistoria, etc.) do mes atual. Cores distintas por tipo.

**Donut de Despesas** -- agrupa `contas_pagar` por campo `categoria` (pecas, mao_de_obra, indenizacao, aluguel, etc.) do mes atual. Cores distintas por categoria.

Cada donut mostra o valor total no centro e legendas com percentual.

### 3. `src/components/financeiro/InadimplenciaIdadeChart.tsx`

Grafico de barras horizontais mostrando o valor total de cobrancas vencidas agrupadas por faixa de atraso:

| Faixa | Filtro |
|-------|--------|
| 1-15 dias | vencimento entre hoje-15 e hoje-1 |
| 16-30 dias | vencimento entre hoje-30 e hoje-16 |
| 31-60 dias | vencimento entre hoje-60 e hoje-31 |
| 61-90 dias | vencimento entre hoje-90 e hoje-61 |
| 90+ dias | vencimento anterior a hoje-90 |

**Dados:** `asaas_cobrancas` com status `OVERDUE/vencido/PENDING/pendente` e `data_vencimento < hoje`. Calcula dias de atraso e agrupa.

Cores de amarelo (leve) a vermelho escuro (grave). Mostra quantidade de cobrancas e valor total por faixa.

### 4. `src/components/financeiro/ResumoMesTable.tsx`

Tabela com colunas: **Item | Previsto | Realizado | Desvio (%)**

Linhas:
- **Receita Total**: previsto = soma de cobrancas emitidas no mes, realizado = soma de pagamentos recebidos
- **Mensalidades**: filtrado por tipo = mensalidade
- **Adesoes**: filtrado por tipo = adesao
- **Despesas Total**: previsto = soma contas_pagar do mes, realizado = soma valor_pago
- **Por categoria**: cada categoria de contas_pagar como sub-linha
- **Saldo**: receita realizada - despesa realizada

Desvio positivo em verde, negativo em vermelho. Linha de saldo em destaque (bold/fundo).

## Arquivo a Modificar

### `src/pages/financeiro/FinanceiroDashboard.tsx`

Adicionar os 4 componentes na area principal (coluna de 2/3), apos o grafico de Fluxo de Caixa existente:

```
Ordem no layout:
1. [existente] Alerta vencendo hoje
2. [existente] Ultimas Movimentacoes
3. [existente] Fluxo de Caixa (30 dias)
4. [NOVO] Receita vs Despesa (12 meses)     -- full width
5. [NOVO] Composicao Receita | Despesa       -- grid 2 colunas
6. [NOVO] Inadimplencia por Idade            -- sidebar ou full
7. [NOVO] Tabela Resumo do Mes               -- full width
```

Os itens 4-7 ficam abaixo do grid principal existente (fora do `lg:grid-cols-3`), em largura total da pagina.

## Detalhes Tecnicos

- Todos os componentes usam `useQuery` do TanStack React Query para buscar dados
- Graficos usam `recharts` (ja instalado): `BarChart`, `PieChart`, `Cell`, `ResponsiveContainer`
- Formatacao monetaria reutiliza `formatCurrency` ja existente
- Periodo padrao: mes atual para composicao e resumo, 12 meses para receita vs despesa
- Skeleton loading em todos os componentes durante carregamento
- Nenhuma migracao de banco necessaria -- todos os dados ja existem nas tabelas `asaas_cobrancas` e `contas_pagar`

