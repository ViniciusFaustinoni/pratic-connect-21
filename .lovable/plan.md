

# Fix: Exportar PDF completo do Dashboard Executivo

## Problema
O botão "Exportar" gera um PDF com apenas 6 KPIs básicos e a evolução mensal. Faltam todos os outros dados visíveis no dashboard: indicadores operacionais, distribuição por plano, rateio, métricas de tempo, rastreadores por portador.

## Solução
Expandir o PDF exportado para incluir todas as seções de dados disponíveis no dashboard:

**Arquivo:** `src/pages/diretoria/DiretoriaDashboard.tsx` (linhas 292-340)

Adicionar ao PDF após os KPIs e evolução mensal:

1. **Indicadores Operacionais** - tabela com instalações e assistências do período (`operacionais`)
2. **Distribuição por Plano** - tabela com nome do plano e quantidade de associados (`distribuicao`)
3. **Rateio Atual** - valor da cota e status do rateio (`rateioAtual`)
4. **Métricas de Tempo** - tempos médios de processos (`metricasTempo`)
5. **Rastreadores por Portador** - distribuição dos rastreadores (`rastreadoresPortador`)

Cada seção será adicionada como uma tabela `autoTable` com título, verificando se os dados existem antes de incluir. Páginas adicionais serão criadas automaticamente pelo jsPDF quando necessário.

## Arquivos a modificar
1. `src/pages/diretoria/DiretoriaDashboard.tsx` — expandir lógica do onClick do botão Exportar

