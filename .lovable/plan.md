
# Plano de Implementacao: Itens Pendentes do PRD

## Analise do Estado Atual vs PRD

Apos revisar o codigo atual e comparar com o documento tecnico (PDF), identifiquei os seguintes gaps que precisam ser implementados:

---

## Status da Implementacao Atual

### JA IMPLEMENTADO
| Item | Status | Arquivo |
|------|--------|---------|
| Regra 75% FIPE (Perda Total vs Dano Parcial) | OK | `NovaOSModal.tsx` |
| Campo `tipo_dano` na tabela sinistros | OK | Migracao executada |
| Campo `valor_participacao` na tabela sinistros | OK | Migracao executada |
| Status `em_sindicancia` no banco | OK | Enum atualizado |
| Navegacao Sinistro -> OS com URL params | OK | `OrdensServicoList.tsx` |
| Validacao bloqueio OS para Perda Total | OK | `NovaOSModal.tsx` |
| Exibicao tipo_dano e participacao no detalhe | OK | `SinistroDetalhe.tsx` |
| Status `em_sindicancia` no detalhe do sinistro | OK | `SinistroDetalhe.tsx` linha 59 |

### PENDENTE DE IMPLEMENTACAO
| Item | Prioridade | Impacto |
|------|------------|---------|
| Status `em_sindicancia` no Dashboard Eventos | ALTA | Dashboard incompleto |
| KPIs Dashboard Assistencia: Taxa transferencia, Custo operacional, Tempo medio | MEDIA | Metricas faltantes |
| KPIs Dashboard Eventos: Em sindicancia, Tempo medio analise | MEDIA | Metricas faltantes |
| Calculo automatico tipo_dano ao emitir parecer | MEDIA | Workflow incompleto |

---

## Implementacoes Necessarias

### 1. Adicionar `em_sindicancia` no Dashboard de Eventos
**Arquivo:** `src/pages/eventos/SinistrosDashboard.tsx`

**Alteracoes necessarias:**
1. Adicionar `em_sindicancia` ao `statusConfig` (linha 55-69)
2. Adicionar card KPI "Em Sindicancia" no grid de metricas
3. Incluir na query de metricas a contagem de sinistros em sindicancia

```text
Resultado esperado:
- Card "Em Sindicancia" exibido no dashboard
- Cor rosa (bg-rose-100 text-rose-800) consistente com outras telas
```

### 2. Adicionar KPIs Faltantes no Dashboard de Assistencia 24h
**Arquivo:** `src/pages/assistencia/AssistenciaDashboard.tsx`

**KPIs a adicionar (conforme PRD secao 8.1):**
1. **Taxa de Transferencia para Eventos** - % de chamados que viraram sinistros
2. **Custo Operacional Total** - Soma dos custos do dia (campo `custo_total` na tabela)
3. **Tempo Medio de Atendimento** - Media de tempo entre abertura e conclusao

**Alteracoes necessarias:**
1. Estender a query de estatisticas para calcular:
   - Contagem de chamados com `sinistro_id` preenchido (transferidos)
   - Soma do campo `custo_total` 
   - Media de `(data_conclusao - data_abertura)` em minutos

2. Adicionar novos cards no grid de KPIs

### 3. Adicionar KPIs Faltantes no Dashboard de Eventos
**Arquivo:** `src/pages/eventos/SinistrosDashboard.tsx`

**KPIs a adicionar (conforme PRD secao 8.2):**
1. **Eventos em Sindicancia** - Contagem de sinistros com status `em_sindicancia`
2. **Tempo Medio de Analise** - Media de dias entre `created_at` e `data_parecer`
3. **Valor Total Aprovado** (ja existe mas verificar se diferencia de pago)

**Alteracoes necessarias:**
1. Na query `sinistros-metricas`:
   - Adicionar contagem de `em_sindicancia`
   - Calcular tempo medio de analise
2. Adicionar card "Em Sindicancia" com contador
3. Adicionar card "Tempo Medio Analise" em dias

### 4. Calculo Automatico de `tipo_dano` ao Emitir Parecer
**Arquivo:** `src/components/eventos/EmitirParecerModal.tsx`

**Logica a implementar:**
```text
Quando analista emite parecer com valor_indenizacao:
1. Se valor_indenizacao >= (valor_fipe * 0.75) → tipo_dano = 'perda_total'
2. Se valor_indenizacao < (valor_fipe * 0.75) → tipo_dano = 'parcial'
```

**Alteracoes necessarias:**
1. Ao salvar o parecer, calcular e atualizar `tipo_dano` automaticamente
2. Exibir preview da classificacao no modal antes de salvar

---

## Resumo de Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/eventos/SinistrosDashboard.tsx` | Adicionar statusConfig para em_sindicancia + KPIs |
| `src/pages/assistencia/AssistenciaDashboard.tsx` | Adicionar 3 novos KPIs |
| `src/components/eventos/EmitirParecerModal.tsx` | Calculo automatico tipo_dano |

---

## Detalhes Tecnicos

### Calculo de Taxa de Transferencia (Assistencia)
```sql
-- Pseudo-codigo
taxa_transferencia = (COUNT(*) WHERE sinistro_id IS NOT NULL) / COUNT(*) * 100
```

### Calculo de Tempo Medio Atendimento (Assistencia)
```sql
-- Pseudo-codigo  
tempo_medio = AVG(EXTRACT(EPOCH FROM (data_conclusao - data_abertura)) / 60)
-- Resultado em minutos
```

### Calculo de Tempo Medio Analise (Eventos)
```sql
-- Pseudo-codigo
tempo_analise = AVG(EXTRACT(DAY FROM (data_parecer - created_at)))
-- Resultado em dias
```

---

## Ordem de Implementacao

1. **Dashboard Eventos** - Adicionar status `em_sindicancia` no statusConfig e KPIs
2. **Dashboard Assistencia** - Adicionar 3 novos KPIs (taxa transferencia, custo, tempo)
3. **EmitirParecerModal** - Calculo automatico do tipo_dano

---

## Resultado Final Esperado

Apos implementacao:

1. **Dashboard Assistencia** mostrara:
   - Chamados Hoje (ja existe)
   - Em Aberto (ja existe)
   - Em Andamento (ja existe)
   - Concluidos (ja existe)
   - **Taxa Transferencia Eventos** (NOVO)
   - **Custo Operacional Total** (NOVO)
   - **Tempo Medio Atendimento** (NOVO)

2. **Dashboard Eventos** mostrara:
   - Total Sinistros (ja existe)
   - Em Aberto (ja existe)
   - Taxa Aprovacao (ja existe)
   - Valor Total Pago (ja existe)
   - **Em Sindicancia** (NOVO)
   - **Tempo Medio Analise** (NOVO)

3. **Emissao de Parecer** calculara automaticamente `tipo_dano` baseado na regra 75% FIPE
