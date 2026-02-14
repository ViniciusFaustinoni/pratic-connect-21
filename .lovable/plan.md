
# Relatorios de Oficinas -- Nova Area no Submenu

## Objetivo

Criar uma nova pagina "Relatorios" dentro do submenu de Oficinas no sidebar, exibindo:

1. **Veiculos em reparo por oficina** -- quantidade de OS com status ativo em cada oficina
2. **Tempo medio de conclusao** -- media de dias entre entrada e conclusao/retirada por oficina

## Alteracoes

### 1. Nova pagina `src/pages/oficinas/OficinasRelatorios.tsx`

Pagina com duas secoes principais:

**Tabela/Cards de Oficinas com metricas:**
- Nome da oficina
- Quantidade de veiculos em reparo (OS com status ativo: aguardando_entrada, aguardando_orcamento, aguardando_aprovacao, em_execucao, aguardando_peca, pendente_assinatura)
- Tempo medio de conclusao em dias (calculado a partir de OS finalizadas usando `data_entrada` e `data_conclusao_real` ou `data_retirada`)
- Indicador visual (badge colorido) para oficinas com muitos veiculos ou tempo medio alto

**Dados vindos de duas queries:**
- Query 1: Agrupar `ordens_servico` por `oficina_id` onde status e ativo, contar quantidade, fazer join com `oficinas` para nome
- Query 2: Para OS finalizadas/concluidas, calcular media de `tempo_total_dias` (ja existe na tabela) ou diferenca entre `data_entrada` e `data_conclusao_real`

### 2. Atualizar sidebar (`src/components/layout/AppSidebar.tsx`)

Adicionar item "Relatorios" ao grupo `oficinas`:

```
{ title: 'Relatorios', url: '/oficinas/relatorios', icon: BarChart3 }
```

### 3. Adicionar rota (`src/App.tsx`)

Registrar a nova rota `/oficinas/relatorios` apontando para `OficinasRelatorios`.

## Detalhes Tecnicos

### Query de veiculos em reparo

```sql
SELECT oficina_id, count(*) as total_em_reparo
FROM ordens_servico
WHERE status IN ('aguardando_entrada','aguardando_orcamento','aguardando_aprovacao','em_execucao','aguardando_peca','pendente_assinatura')
GROUP BY oficina_id
```

### Query de tempo medio

Usar a coluna `tempo_total_dias` das OS com status `finalizado`, `concluido` ou `entregue`, agrupando por `oficina_id` e calculando a media.

### Layout da pagina

| Oficina | Veiculos em Reparo | Tempo Medio (dias) |
|---|---|---|
| Oficina A | 5 | 12.3 |
| Oficina B | 2 | 8.7 |
| Oficina C | 0 | 15.1 |

Incluir tambem um grafico de barras (usando recharts, ja instalado) para visualizacao rapida.

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Criar | `src/pages/oficinas/OficinasRelatorios.tsx` |
| Modificar | `src/components/layout/AppSidebar.tsx` (adicionar item no menu) |
| Modificar | `src/App.tsx` (adicionar rota) |
