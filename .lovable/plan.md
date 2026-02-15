
# Modulo Marketing — Gaps e Implementacao Completa

## Estado Atual

O modulo de marketing ja esta **~75% implementado** com boa cobertura funcional:

### Ja implementado:
- **Dashboard**: 8 KPIs, 2 graficos (evolucao leads, funil conversao), leads por origem, campanhas ativas, indicacoes recentes
- **Campanhas**: CRUD completo, detalhe com metricas/leads/UTMs/materiais, pausar/ativar/finalizar, formulario dedicado
- **Canais**: CRUD com toggle ativo/inativo, metricas de performance (via view_performance_canais)
- **Indicacoes**: CRUD, stats, tabs (todas/pendentes/convertidas/recompensadas/pendentes pagamento), ranking de indicadores, configuracao do programa
- **UTMs**: gerador com preview, 5 parametros, vinculacao a campanha, tabela de UTMs salvos
- **Distribuicao**: config on/off, vendedores com limites e status, historico, rodizio simples (em `/marketing/distribuicao` e `/vendas/config`)
- **Relatorios**: KPIs, leads por origem, conversoes por canal, tabela por canal/campanha/indicacoes, export PDF
- **Extras**: Landing Pages, Materiais, Comunicacao em Massa, Redes Sociais (paginas existentes)

### Database: Todas as tabelas necessarias existem (campanhas, canais_marketing, indicacoes, programa_indicacao, utms, materiais_marketing, distribuicao_config, distribuicao_vendedores, distribuicao_historico). Leads ja tem campos campanha_id e UTMs.

---

## Gaps Identificados

### Gap 1 — Dashboard: Graficos faltantes da especificacao

**Atual**: 2 graficos (Evolucao de Leads 12m e Funil de Conversao)

**Especificacao exige 5 graficos**:
1. Leads por Canal (barras agrupadas, 6 meses) — **falta**
2. Funil de Conversao por Canal (comparativo) — parcial (funil existe mas nao separa por canal)
3. CAC por Canal (barras horizontais) — **falta**
4. Investimento vs Retorno por Canal — **falta**
5. Leads por Dia (linha, 30 dias) — **falta**

**Acao**: Adicionar os 4 graficos faltantes ao dashboard. Reorganizar layout para acomodar 5 graficos + KPIs + campanhas ativas.

### Gap 2 — Dashboard: KPIs incompletos

**Atual**: 8 cards (Leads, Conversoes, Taxa Conversao, ROI, Investimento, CPL, Indicacoes, Campanhas Ativas)

**Falta**: CAC (Custo de Aquisicao por associado), Melhor Canal (nome + CAC). Os 8 cards existentes cobrem a maioria mas faltam 2 metricas-chave da especificacao. O ROI atual usa formula simplificada (conversoes * 150).

**Acao**: Substituir 2 cards menos relevantes por CAC e Melhor Canal, ou expandir para 10 cards. Melhorar calculo do ROI.

### Gap 3 — Canais: Detalhe do Canal

**Atual**: Cards com metricas basicas + toggle ativo + editar. Nao tem detalhe ao clicar.

**Especificacao exige**: Ao clicar no canal, mostrar metricas historicas (12 meses com graficos), campanhas vinculadas, leads do canal, qualidade do lead (tempo de conversao, retencao 6 meses).

**Acao**: Criar pagina `CanalDetalhe.tsx` com tabs: Metricas historicas (graficos), Campanhas, Leads, Qualidade.

### Gap 4 — Campanhas: Funcionalidades faltantes

**Atual**: Campanhas tem CRUD completo e detalhe bom.

**Falta**:
- Botao "Duplicar" — existe no dropdown mas mostra toast "em desenvolvimento"
- Botao "Relatorio PDF" da campanha individual — nao implementado
- Campanha tipos: especificacao menciona "trafego pago, organica, indicacao, offline, parceria" mas o sistema usa "aquisicao, reativacao, indicacao, remarketing, branding, promocional, sazonal" — manter os atuais pois sao mais granulares

**Acao**: Implementar duplicacao e relatorio PDF da campanha.

### Gap 5 — UTMs: Analise e Agrupamento

**Atual**: Gerador + tabela de UTMs com cliques e leads.

**Falta**: Secao de analise com agrupamento por qualquer parametro (source, medium, campaign, content, term). O gestor seleciona "Agrupar por: utm_content" e ve tabela agregada com leads, conversoes, taxa, CPL.

**Acao**: Adicionar secao "Analise de UTMs" com select de agrupamento e tabela dinamica.

### Gap 6 — Distribuicao: Regras avancadas

**Atual**: Round robin simples com limites diarios, status por vendedor, historico.

**Falta**:
- Regras de distribuicao por canal/campanha/regiao (a especificacao descreve sistema com regras em prioridade)
- Distribuicao por performance (ponderada por taxa de conversao)
- Monitoramento em tempo real (tempo medio de primeiro contato, alertas)
- Redistribuicao manual

**Acao**: Isso exigiria uma tabela `regras_distribuicao` no banco e logica complexa. Implementar versao MVP: adicionar selector de metodo (rodizio vs performance) na config, e exibir alertas basicos.

### Gap 7 — Relatorios: Relatorios avancados faltantes

**Atual**: Visao geral, por canal, por campanha, indicacoes. PDF basico.

**Falta**:
- Relatorio de Consultores (leads recebidos, tempo de primeiro contato, conversao, ranking)
- Relatorio de ROI Completo (LTV, LTV/CAC)
- Relatorio de Qualidade do Lead (% qualificados por canal)
- Relatorio de Jornada do Lead (tempo por etapa do funil, por canal)
- Gerador de relatorios personalizado

**Acao**: Adicionar 3 tabs ao RelatoriosMarketing: "Consultores", "ROI/LTV", "Jornada". O gerador personalizado e complexo — registrar como futuro.

---

## Plano de Implementacao

### Etapa 1 — Dashboard Completo (graficos + KPIs)

Modificar `MarketingDashboard.tsx`:

**Novos KPIs** (substituir ROI simplificado e Campanhas por):
- CAC (investimento / conversoes)
- Melhor Canal (canal com menor CAC com pelo menos 5 leads)

**Novos graficos**:
- Leads por Canal (BarChart agrupado, 6 meses) — query por canal/mes
- CAC por Canal (BarChart horizontal) — usando view_performance_canais
- Investimento vs Retorno por Canal (BarChart agrupado)
- Leads por Dia (LineChart, 30 dias) — query leads por dia

Novo hook em `useMarketing.ts`:
- `useLeadsPorCanal6Meses()` — leads agrupados por canal e mes
- `useLeadsPorDia()` — leads dos ultimos 30 dias

### Etapa 2 — Detalhe do Canal

Criar `src/pages/marketing/CanalDetalhe.tsx`:
- Rota: `/marketing/canais/:id`
- Header com nome, tipo, status
- KPIs: leads total, conversoes, CPL, CAC, taxa conversao
- Tabs:
  - Metricas Historicas: graficos de leads/mes e CPL/mes (12 meses)
  - Campanhas: tabela de campanhas vinculadas ao canal
  - Leads: tabela de leads com origem = canal

Modificar `Canais.tsx`: cards ficam clicaveis, navegam para detalhe.
Adicionar rota em `App.tsx`.

### Etapa 3 — Campanhas: Duplicar + PDF

Modificar `CampanhaDetalhe.tsx`:
- Implementar duplicacao (insert com dados copiados, nome + " (copia)")
- Implementar export PDF (jspdf com metricas, leads, UTMs)

### Etapa 4 — UTMs: Analise com Agrupamento

Modificar `UTMs.tsx`:
- Adicionar secao inferior "Analise de UTMs"
- Select: "Agrupar por" (source, medium, campaign, content, term)
- Tabela dinamica com leads, conversoes, taxa, CPL
- Query que agrupa os UTMs pelo parametro selecionado

### Etapa 5 — Distribuicao: Metodo de distribuicao

Modificar schema `distribuicao_config`: adicionar coluna `metodo` (rodizio, performance).
Modificar `DistribuicaoConfig.tsx`: adicionar selector de metodo.
Adicionar alertas basicos (vendedores com muitos leads pendentes).

### Etapa 6 — Relatorios Avancados

Modificar `RelatoriosMarketing.tsx`:
- Tab "Consultores": vendedores com leads recebidos, conversoes, taxa, tempo medio
- Tab "ROI/LTV": calculo de LTV por canal (contribuicao media * meses retencao), LTV/CAC
- Tab "Jornada": tempo medio em cada etapa do funil, por canal

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/marketing/CanalDetalhe.tsx` | Pagina de detalhe do canal com metricas historicas |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/marketing/MarketingDashboard.tsx` | 2 novos KPIs (CAC, Melhor Canal), 4 novos graficos |
| `src/hooks/useMarketing.ts` | Hooks: useLeadsPorCanal6Meses, useLeadsPorDia, useCACPorCanal |
| `src/pages/marketing/Canais.tsx` | Cards clicaveis com navigate para detalhe |
| `src/pages/marketing/CampanhaDetalhe.tsx` | Implementar duplicacao e PDF |
| `src/pages/marketing/UTMs.tsx` | Secao de analise com agrupamento |
| `src/pages/marketing/RelatoriosMarketing.tsx` | 3 novas tabs (Consultores, ROI/LTV, Jornada) |
| `src/pages/vendas/DistribuicaoConfig.tsx` | Selector de metodo (rodizio/performance), alertas |
| `src/App.tsx` | Rota /marketing/canais/:id |

## Migracao SQL

Adicionar coluna `metodo` na tabela `distribuicao_config`:
```sql
ALTER TABLE distribuicao_config ADD COLUMN IF NOT EXISTS metodo varchar DEFAULT 'rodizio';
```

## Detalhes Tecnicos

- Graficos usam recharts (BarChart, LineChart, PieChart) — ja instalado
- PDF usa jspdf + jspdf-autotable — ja instalado
- KPIs de CAC calculados no frontend: investimento total / conversoes totais
- LTV calculado como: valor medio mensalidade * meses retencao media (12 * 0.8)
- Leads por canal: query `leads` agrupado por `origem` por mes (ultimos 6)
- Performance canais: usa view `view_performance_canais` existente
- Detalhe do canal: query `leads` filtrado por origem + campanhas filtradas por canal_id
