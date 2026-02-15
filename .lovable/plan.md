

# Gaps Finais do Modulo Marketing (Rodada 2)

## Estado Atual

O modulo de Marketing esta **~95% implementado** apos a rodada anterior. Todos os gaps principais (Dashboard KPIs, graficos, CanalDetalhe, duplicacao de campanha, analise UTMs, metodo de distribuicao, tabs ROI/LTV) foram resolvidos.

Restam 3 gaps menores:

---

## Gap 1 — PDF de Campanha Individual

**Atual**: O botao de PDF na campanha nao existe. O RelatoriosMarketing.tsx ja tem jsPDF funcionando para relatorios gerais, mas CampanhaDetalhe.tsx nao tem export.

**Acao**: Adicionar botao "Exportar PDF" no header do detalhe da campanha. Gerar PDF com: informacoes gerais, metricas de performance, lista de leads e UTMs vinculadas.

**Arquivo**: `src/pages/marketing/CampanhaDetalhe.tsx`

---

## Gap 2 — Tab Consultores (Relatorios)

**Atual**: Mostra placeholder "Relatorio de consultores com leads recebidos..."

**Acao**: Implementar tabela real com dados do pipeline. Query leads agrupados por `vendedor_id`, contando leads recebidos, conversoes (etapa ganho), taxa de conversao. Ranking ordenado por conversoes.

**Arquivo**: `src/pages/marketing/RelatoriosMarketing.tsx`

---

## Gap 3 — Tab Jornada (Relatorios)

**Atual**: Mostra placeholder "Analise de tempo medio em cada etapa..."

**Acao**: Implementar tabela com tempo medio em cada etapa do funil por origem. Query leads com `created_at` e `updated_at` por etapa para calcular permanencia media. Como nao temos timestamps por etapa individual (so `created_at` e `updated_at`), mostrar tempo total lead-to-conversion por canal (diferenca entre created_at do lead com etapa=ganho e created_at original).

**Arquivo**: `src/pages/marketing/RelatoriosMarketing.tsx`

---

## Resumo de Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/marketing/CampanhaDetalhe.tsx` | Botao e funcao de export PDF com jsPDF |
| `src/pages/marketing/RelatoriosMarketing.tsx` | Implementar tabs Consultores e Jornada com dados reais |

---

## Detalhes Tecnicos

**PDF da Campanha:**
- Import `jsPDF` e `autoTable` (ja instalados)
- Gerar tabela com: nome, tipo, status, periodo, orcamento, gasto, leads, conversoes, CPL, CAC, ROI
- Incluir lista dos leads da campanha (nome, telefone, etapa, data)
- Incluir UTMs vinculadas (source, medium, campaign, leads)

**Tab Consultores:**
- Query `leads` agrupados por `vendedor_id` com join em `usuarios` para nome
- Filtro por periodo selecionado
- Colunas: Posicao, Consultor, Leads Recebidos, Conversoes, Taxa, Tempo Medio (dias entre created_at e updated_at para leads ganhos)

**Tab Jornada:**
- Query leads com etapa `ganho` agrupados por `origem`
- Calcular dias medios entre `created_at` e `updated_at` por origem
- Colunas: Canal, Leads Convertidos, Tempo Medio (dias), Mais Rapido, Mais Lento

