

# Dashboard de Eventos — Redesign Completo

## Escopo

Substituir o `SinistrosDashboard.tsx` atual (562 linhas, 6 KPIs basicos + 2 graficos + 1 tabela) por um dashboard completo com 6 areas, conforme especificacao. O arquivo atual sera reescrito e a logica dividida em hooks e componentes dedicados.

## Arquitetura

O dashboard sera dividido em:
- 1 pagina principal (`SinistrosDashboard.tsx`) com layout e filtros globais
- 1 hook de dados (`useEventosDashboard.ts`) com todas as queries otimizadas
- 6 componentes de area, um para cada secao do dashboard

## Estrutura de Arquivos

```text
src/pages/eventos/SinistrosDashboard.tsx          -- pagina principal (reescrita)
src/hooks/useEventosDashboard.ts                  -- hook com todas as queries
src/components/eventos/dashboard/
  EventosKPICards.tsx                              -- Area 1: 6 cards KPI
  EventosFunilOperacional.tsx                      -- Area 2: funil horizontal
  EventosGraficosTipo.tsx                          -- Area 3: donut + barras mensais
  EventosGraficosAnalise.tsx                       -- Area 4: taxa aprovacao + tempo medio + custos
  EventosAlertasUrgentes.tsx                       -- Area 5: alertas vermelhos/amarelos/azuis
  EventosTabelaRecentes.tsx                        -- Area 6: tabela com filtros
```

---

## Area 1 — Cards KPI (6 cards)

| Card | Query | Cor |
|---|---|---|
| Eventos Abertos | `count WHERE status NOT IN (finalizado, encerrado, cancelado)` | Azul |
| Novos este Mes | `count WHERE created_at >= inicio_mes` + variacao vs mes anterior | Verde/Vermelho |
| Aguardando Acao | `count WHERE status IN (documentacao_pendente, aguardando_analise, aguardando_vistoria, pronto_para_oficina, aguardando_confirmacoes, aguardando_parecer)` | Laranja |
| Em Oficina | `count WHERE status IN (em_regulacao, em_reparo, aguardando_peca)` | Indigo |
| Em Recuperacao | `count WHERE status = em_recuperacao` | Roxo |
| Indenizacoes Pendentes | `count + SUM(valor_fipe) WHERE status = aguardando_pagamento` | Ambar |

Cada card mostra numero grande + icone + variacao percentual (quando aplicavel). Skeleton loading individual.

---

## Area 2 — Funil Operacional

Barra horizontal com 9 fases. Cada fase mostra contagem. Clique filtra a tabela abaixo.

Mapeamento de status para fases:
1. Comunicado: `comunicado`
2. Documentacao: `documentacao_pendente`
3. Vistoria: `aguardando_vistoria, em_vistoria`
4. Analise: `em_analise, aguardando_parecer`
5. Pagamento/Cota: `aprovado` (aguardando cota/termo)
6. Atribuicao: `pronto_para_oficina`
7. Em Oficina: `em_regulacao, em_reparo, aguardando_peca`
8. Concluido: `concluido` (se existir) ou eventos com reparo finalizado
9. Finalizado: `encerrado, pago` (total do mes)

Abaixo do funil: tempo medio total do comunicado ao finalizado, separado por tipo.

---

## Area 3 — Graficos (2 colunas)

**Esquerdo — Donut "Eventos por Tipo"**
- PieChart com innerRadius (donut)
- Total no centro
- Cores: colisao=azul, roubo=vermelho, furto=roxo, incendio=laranja, alagamento=ciano, vidros=verde

**Direito — Barras "Eventos por Mes" (ultimos 6 meses)**
- BarChart com barras empilhadas por tipo
- Tooltips com quantidade e tipo

---

## Area 4 — Segunda Linha de Graficos (3 colunas)

**Grafico 1 — Taxa de Aprovacao (gauge simulado)**
- Representado como um card com numero grande + barra de progresso circular ou semi-circular
- Verde >80%, Amarelo 60-80%, Vermelho <60%
- Subtexto: X aprovados, Y reprovados, Z em sindicancia

**Grafico 2 — Tempo Medio por Fase (barras horizontais)**
- BarChart horizontal com tempo medio em dias por transicao de fase
- Barras em vermelho quando acima da meta (documentacao <3d, vistoria <5d, analise <7d, oficina <30d)
- Nota: calculo baseado em `created_at` e `updated_at` dos sinistros, ja que nao temos timestamps por fase. Usaremos estimativas baseadas em `data_parecer` e datas disponiveis.

**Grafico 3 — Custos Acumulados (area empilhada, 6 meses)**
- AreaChart com series: valor_orcamento (pecas+mao obra), valor_pago (indenizacoes), valor_cota_participacao (cotas recebidas)
- Visivel apenas para diretor/gerente

---

## Area 5 — Alertas e Acoes Urgentes

Queries independentes para cada alerta:

**Vermelhos (criticos):**
- Eventos sem atualizacao ha mais de 48h: `WHERE updated_at < NOW() - 48h AND status NOT IN (encerrado, cancelado)`
- Documentacao pendente ha mais de 15 dias: `WHERE status = documentacao_pendente AND updated_at < NOW() - 15d`
- Veiculos em oficina ha mais de 60 dias: `WHERE status IN (em_reparo, em_regulacao) AND updated_at < NOW() - 60d`
- Indenizacoes com prazo vencendo: `WHERE status = aguardando_pagamento AND created_at < NOW() - 50d` (proximo do limite de 60 dias uteis)

**Amarelos (atencao):**
- Analise ha mais de 7 dias: `WHERE status IN (em_analise, aguardando_parecer) AND updated_at < NOW() - 7d`
- Recuperacao ha mais de 20 dias: `WHERE status = em_recuperacao AND updated_at < NOW() - 20d`
- Garantias vencendo: `WHERE data_garantia_fim BETWEEN NOW() AND NOW() + 7d`

**Azuis (informativo):**
- Finalizados este mes: `count WHERE status IN (encerrado, pago) AND updated_at >= inicio_mes`
- Cotas pendentes: `count WHERE cota_paga = false AND status NOT IN (cancelado, negado)`

Cada alerta tem icone, mensagem, contagem e botao de acao que navega para a lista filtrada.

---

## Area 6 — Tabela de Eventos Recentes

- 20 ultimos eventos (criados ou atualizados)
- Colunas: Protocolo (link), Tipo (badge), Associado, Veiculo (placa - marca/modelo), Status (badge colorido), Fase atual (texto descritivo), Dias aberto, Ultima atualizacao (relativa)
- Filtros: tipo (multi-select), status (multi-select), periodo (date range), busca texto
- Ordenacao por qualquer coluna
- Botao "+ Novo Evento" no canto superior direito

---

## Filtros Globais (topo)

Barra no topo antes dos KPIs:
- Periodo: Hoje, Esta Semana, Este Mes (padrao), Ultimo Trimestre, Este Ano, Personalizado
- Tipo de evento: Todos (padrao), selecionar especifico
- Status: Todos, Apenas Abertos (padrao), Apenas Finalizados

Esses filtros afetam TODOS os componentes via state passado como props.

---

## Cores de Status (constantes compartilhadas)

```text
comunicado         -> cinza (bg-gray-100 text-gray-800)
documentacao_pend  -> amarelo (bg-yellow-100 text-yellow-800)
aguardando_vistoria -> azul claro (bg-sky-100 text-sky-800)
aguardando_analise -> roxo (bg-purple-100 text-purple-800)
aprovado           -> verde (bg-green-100 text-green-800)
negado             -> vermelho (bg-red-100 text-red-800)
em_recuperacao     -> roxo escuro (bg-violet-100 text-violet-800)
pronto_para_oficina -> ciano (bg-cyan-100 text-cyan-800)
em_reparo          -> indigo (bg-indigo-100 text-indigo-800)
aguardando_peca    -> laranja (bg-orange-100 text-orange-800)
concluido          -> verde claro (bg-lime-100 text-lime-800)
encerrado          -> verde escuro (bg-emerald-100 text-emerald-800)
cancelado          -> cinza escuro (bg-slate-100 text-slate-800)
em_sindicancia     -> amarelo escuro (bg-amber-100 text-amber-800)
aguardando_pagamento -> ambar (bg-amber-100 text-amber-800)
```

---

## Permissoes

- Diretor/Gerente: tudo visivel, incluindo valores financeiros
- Analista de Eventos: tudo exceto valores em custos acumulados e indenizacoes (ve contadores mas nao valores)
- Regulador: apenas seus proprios dados (filtro por analista_id = user.id)
- Vendedor/Consultor: sem acesso (ja bloqueado pela rota)

O hook `usePermissions()` ja existe e sera usado para controle condicional.

---

## Responsividade

- Cards KPI: 6 colunas em desktop, 2 em mobile
- Graficos Area 3: 2 colunas desktop, 1 mobile
- Graficos Area 4: 3 colunas desktop, 1 mobile
- Funil: scroll horizontal em mobile
- Tabela: scroll horizontal em mobile

---

## Performance

- Queries separadas por area (carregamento paralelo)
- Cada secao com skeleton loading independente
- RefetchInterval de 120s para dados em tempo real
- Contadores agregados via `count: 'exact'` + `head: true` quando possivel

---

## Ordem de Implementacao

1. Hook `useEventosDashboard.ts` com todas as queries
2. `EventosKPICards.tsx` (Area 1)
3. `EventosFunilOperacional.tsx` (Area 2)
4. `EventosGraficosTipo.tsx` (Area 3)
5. `EventosGraficosAnalise.tsx` (Area 4)
6. `EventosAlertasUrgentes.tsx` (Area 5)
7. `EventosTabelaRecentes.tsx` (Area 6)
8. `SinistrosDashboard.tsx` reescrito integrando tudo + filtros globais

