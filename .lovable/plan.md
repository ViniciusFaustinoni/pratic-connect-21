
# Plano de Implementacao: Itens Pendentes do PRD

## Status: ✅ CONCLUÍDO

---

## Implementações Realizadas

### ✅ 1. Dashboard Eventos - Status em_sindicancia + KPIs
**Arquivo:** `src/pages/eventos/SinistrosDashboard.tsx`

Alterações realizadas:
- Adicionado `em_sindicancia` ao `statusConfig` com cor rosa
- Adicionado card KPI "Em Sindicância" com contador
- Adicionado card KPI "Tempo Médio Análise" em dias
- Expandido grid de 4 para 6 colunas

### ✅ 2. Dashboard Assistência - KPIs Adicionais
**Arquivo:** `src/pages/assistencia/AssistenciaDashboard.tsx`

Alterações realizadas:
- Adicionado card "Tempo Médio de Atendimento" em minutos
- Expandido grid para 5 colunas

**Nota:** KPIs de "Taxa de Transferência" e "Custo Operacional" aguardam migração para adicionar campos `sinistro_id` e `custo_total` na tabela `chamados_assistencia`.

### ✅ 3. EmitirParecerModal - Cálculo Automático tipo_dano
**Arquivo:** `src/components/eventos/EmitirParecerModal.tsx`

Alterações realizadas:
- Implementado cálculo automático de `tipo_dano` baseado na regra 75% FIPE
- Adicionado preview visual da classificação (Perda Total / Dano Parcial) antes de salvar
- Campo `tipo_dano` é salvo automaticamente no banco ao emitir parecer

---

## Resumo do Fluxo Implementado

1. **Assistência 24h** → Pode transferir chamado para Eventos (sinistro)
2. **Eventos** → Analista emite parecer com valor
3. **Parecer** → Sistema calcula automaticamente:
   - Se `valor_indenizacao >= 75% FIPE` → `tipo_dano = 'perda_total'`
   - Se `valor_indenizacao < 75% FIPE` → `tipo_dano = 'parcial'`
4. **Oficina** → Ao tentar criar OS:
   - Se `tipo_dano = 'perda_total'` → BLOQUEADO (vai para indenização)
   - Se `tipo_dano = 'parcial'` → Permite criar OS

---

## Próximos Passos (Opcionais)

Para habilitar os KPIs faltantes no Dashboard de Assistência, seria necessário:

```sql
-- Adicionar campos para rastreamento de transferência e custos
ALTER TABLE public.chamados_assistencia 
ADD COLUMN IF NOT EXISTS sinistro_id UUID REFERENCES sinistros(id);

ALTER TABLE public.chamados_assistencia 
ADD COLUMN IF NOT EXISTS custo_total NUMERIC(12,2) DEFAULT 0;
```


