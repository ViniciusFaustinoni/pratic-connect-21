

# Organização de Cotações Finalizadas por Data e Consultor

## O que será feito

Adicionar à tela de Cotações (`/vendas/cotacoes`) uma separação por abas **Em Andamento** / **Finalizadas**, com agrupamento visual por data e filtros dedicados de data e consultor na aba "Finalizadas".

## Alterações

### 1. `src/pages/vendas/Cotacoes.tsx`

- Adicionar **Tabs** (usando `@/components/ui/tabs`) com duas abas:
  - **Em Andamento**: cotações com status `rascunho`, `enviada`, `visualizada` (fluxo ativo)
  - **Finalizadas**: cotações com status `aceita`, `recusada`, `expirada` ou com `status_contratacao = 'concluido'`
- Na aba **Finalizadas**:
  - Manter os filtros de **data** (calendar picker) e **consultor** (select) visíveis e funcionais
  - Agrupar as cotações por **data de finalização** (campo `updated_at` ou `created_at`), exibindo separadores visuais com a data (ex: "27/03/2026", "26/03/2026")
  - Dentro de cada grupo de data, ordenar por consultor
- O filtro de **consultor** já existe — garantir que funcione corretamente na aba Finalizadas (filtra por `vendedor_id`)
- O filtro de **data** já existe — aplicar na aba Finalizadas comparando com a data de finalização
- Exibir contadores nas abas: "Em Andamento (X)" e "Finalizadas (Y)"
- Consultores (não-diretores) verão apenas suas próprias cotações, respeitando `viewScope`

### 2. `src/components/cotacoes/CotacoesTable.tsx`

- Adicionar prop opcional `groupByDate?: boolean` para renderizar separadores de data entre os grupos de cotações
- Quando ativado, inserir um header de grupo com a data formatada antes de cada bloco

## Resultado esperado

- Diretor vê todas as cotações finalizadas, agrupadas por data
- Pode filtrar por data específica e/ou por consultor
- Ambos os filtros funcionam simultaneamente
- Consultor individual vê apenas suas próprias finalizadas
- Layout limpo com contadores nas abas

