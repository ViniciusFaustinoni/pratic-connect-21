
# Plano de Implementacao: Adequacao do Fluxo de Sinistros ao PRD

## Resumo da Analise

Apos analisar o documento tecnico completo (partes 1-9) e comparar com o codigo atual, identifiquei o nivel de conformidade e os gaps que precisam ser corrigidos.

---

## 1. Analise de Conformidade Atual

### Modulo Assistencia 24h
| Funcionalidade PRD | Status | Observacao |
|-------------------|--------|------------|
| Dashboard com KPIs (chamados hoje, abertos, em andamento, concluidos) | OK | Implementado em `AssistenciaDashboard.tsx` |
| Pipeline de status | OK | 8 status definidos |
| Protocolo automatico (ASS-YYYY-XXXXX) | OK | Via edge function |
| Transferir para Eventos | OK | Botao adicionado recentemente |
| Taxa de transferencia para Eventos | NAO | KPI ausente no dashboard |
| Custo operacional total | NAO | KPI ausente |
| Avaliacao media dos prestadores | NAO | KPI ausente |

### Modulo Eventos (Sinistros)
| Funcionalidade PRD | Status | Observacao |
|-------------------|--------|------------|
| Dashboard com KPIs | PARCIAL | Falta: em sindicancia, valor aprovado no periodo |
| Pipeline de status | PARCIAL | Falta status `em_sindicancia` no banco (apenas no codigo) |
| Link para criar OS | OK | Botao adicionado recentemente |
| Regra 75% FIPE (Dano Parcial vs Perda Total) | NAO | Nao ha campo/logica implementada |
| Campo participacao do associado | NAO | Campo nao existe na tabela sinistros |
| Bloqueio de OS para Perda Total | NAO | Sem validacao |
| Tempo medio de analise | NAO | KPI ausente |
| Contagem eventos em sindicancia | NAO | Ausente |

### Modulo Oficina (OS)
| Funcionalidade PRD | Status | Observacao |
|-------------------|--------|------------|
| Dashboard com KPIs | PARCIAL | KPIs calculados da lista, nao do servidor |
| Criar OS a partir de Sinistro (via URL) | NAO | Pagina nao processa `?novo=true&sinistro_id=` |
| Vinculo com sinistro | OK | FK existe e e usado |
| Regulagem de pecas | NAO | Sem workflow implementado |
| Termo de anuencia/quitacao | NAO | Sem workflow |
| Tempo medio de reparo | NAO | KPI ausente |

---

## 2. Gaps Criticos Identificados

### Gap 1: Pagina de OS nao abre modal com sinistro pre-carregado
**Problema:** O botao "Criar OS" no sinistro navega para `/oficina/ordens-servico?novo=true&sinistro_id=XXX`, mas a pagina nao processa esses parametros.

**Solucao:**
- Adicionar `useSearchParams` para ler parametros da URL
- Auto-abrir modal `NovaOSModal` quando `novo=true`
- Passar `sinistroId` para o modal

### Gap 2: Status "em_sindicancia" nao existe no banco
**Problema:** Adicionamos o status no codigo TypeScript, mas o enum no banco nao foi atualizado.

**Solucao:**
- Executar migracao SQL para adicionar `em_sindicancia` ao enum `status_sinistro`

### Gap 3: Campo "tipo_dano" (parcial/perda_total) ausente
**Problema:** O PRD define que eventos com dano >= 75% FIPE sao "Perda Total" e nao geram OS. Nao existe campo para isso.

**Solucao:**
- Adicionar campo `tipo_dano` (enum: parcial, perda_total) na tabela sinistros
- Calcular automaticamente baseado em `valor_indenizacao` vs `valor_fipe`

### Gap 4: Campo "valor_participacao" ausente no sinistro
**Problema:** O PRD menciona "participacao do associado" como dedutivel. Campo nao existe.

**Solucao:**
- Adicionar campo `valor_participacao` (NUMERIC) na tabela sinistros
- Exibir na tela de detalhe

### Gap 5: Validacao de criacao de OS para Perda Total
**Problema:** Nao ha validacao impedindo criar OS para sinistros classificados como "Perda Total".

**Solucao:**
- Adicionar validacao no modal `NovaOSModal`
- Exibir mensagem explicando que Perda Total vai para indenizacao

---

## 3. Plano de Implementacao

### Fase 1: Correcoes Criticas de Integracao

#### 1.1 Corrigir navegacao Sinistro -> OS
**Arquivo:** `src/pages/oficina/OrdensServicoList.tsx`

Alteracoes:
- Importar `useSearchParams` do react-router-dom
- Adicionar estado `sinistroIdFromUrl` para capturar parametro
- useEffect para abrir modal quando `novo=true`
- Passar `sinistroId` para o componente `NovaOSModal`

```text
Fluxo esperado:
1. Usuario clica "Criar OS" no sinistro
2. Navega para /oficina/ordens-servico?novo=true&sinistro_id=XXX
3. Pagina abre automaticamente modal com sinistro pre-carregado
4. Usuario seleciona oficina e cria OS
```

#### 1.2 Migracao SQL: Adicionar status e campos faltantes
**Arquivo:** Nova migracao SQL

```sql
-- 1. Adicionar status em_sindicancia ao enum
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'em_sindicancia';

-- 2. Adicionar campo tipo_dano
ALTER TABLE public.sinistros 
ADD COLUMN IF NOT EXISTS tipo_dano TEXT 
CHECK (tipo_dano IN ('parcial', 'perda_total'));

-- 3. Adicionar campo valor_participacao
ALTER TABLE public.sinistros 
ADD COLUMN IF NOT EXISTS valor_participacao NUMERIC(12,2) DEFAULT 0;

-- 4. Adicionar indice para tipo_dano
CREATE INDEX IF NOT EXISTS idx_sinistros_tipo_dano 
ON public.sinistros(tipo_dano) 
WHERE tipo_dano IS NOT NULL;
```

### Fase 2: Atualizacoes de Interface

#### 2.1 Exibir campos novos na tela de detalhe do sinistro
**Arquivo:** `src/pages/eventos/SinistroDetalhe.tsx`

Alteracoes no card "Valores":
- Adicionar campo "Tipo de Dano" (Parcial/Perda Total)
- Adicionar campo "Participacao do Associado"
- Adicionar calculo visual: 75% do FIPE

#### 2.2 Validacao no modal de criacao de OS
**Arquivo:** `src/components/oficina/NovaOSModal.tsx`

Alteracoes:
- Verificar se sinistro selecionado tem `tipo_dano = 'perda_total'`
- Se for perda total, exibir alerta e bloquear criacao

#### 2.3 Adicionar status em_sindicancia no Dashboard de Eventos
**Arquivo:** `src/pages/eventos/SinistrosDashboard.tsx`

Alteracoes:
- Adicionar configuracao de cor/label para `em_sindicancia`
- Incluir no calculo de eventos em aberto

### Fase 3: KPIs Adicionais nos Dashboards

#### 3.1 Dashboard Assistencia 24h
**Arquivo:** `src/pages/assistencia/AssistenciaDashboard.tsx`

Novos KPIs a adicionar:
- Taxa de transferencia para Eventos (%)
- Custo operacional total do dia
- Tempo medio de atendimento

#### 3.2 Dashboard Eventos
**Arquivo:** `src/pages/eventos/SinistrosDashboard.tsx`

Novos KPIs a adicionar:
- Eventos em sindicancia
- Tempo medio de analise (dias)
- Valor total aprovado (separado de pago)

---

## 4. Mapa de Arquivos a Modificar

| Arquivo | Tipo de Alteracao |
|---------|-------------------|
| `src/pages/oficina/OrdensServicoList.tsx` | Adicionar processamento de URL params |
| `src/pages/eventos/SinistroDetalhe.tsx` | Exibir novos campos (tipo_dano, participacao) |
| `src/pages/eventos/SinistrosDashboard.tsx` | Adicionar status em_sindicancia |
| `src/components/oficina/NovaOSModal.tsx` | Validacao para Perda Total |
| `src/types/sinistros.ts` | Ja atualizado |
| Nova migracao SQL | Adicionar campos e status ao banco |

---

## 5. Consideracoes de Dados Cruzados (PRD Secao 7.4)

O PRD define onde cada dado deve aparecer. Apos as alteracoes:

| Dado | Origem | Onde Aparece |
|------|--------|--------------|
| Protocolo Sinistro | Eventos | Eventos, Oficina, Financeiro, Historico Associado, App |
| Tipo do Evento | Eventos | Dashboard Eventos, App, Financeiro |
| Status do Evento | Eventos | Dashboard Eventos, Oficina (via OS), App |
| Tipo de Dano | Eventos | Detalhe Sinistro, Decisao de OS |
| Valor Participacao | Eventos | Detalhe Sinistro, Calculo Indenizacao |
| Numero da OS | Oficina | Eventos (vinculado), Financeiro |

---

## 6. Resultado Esperado

Apos implementacao:

1. **Fluxo Assistencia -> Sinistro**: Funcionando (ja implementado)
2. **Fluxo Sinistro -> OS**: Modal abre automaticamente com sinistro pre-carregado
3. **Regra 75% FIPE**: Campo `tipo_dano` permite classificar e bloquear OS para Perda Total
4. **Status Sindicancia**: Disponivel no banco e em todas as telas
5. **Participacao**: Campo visivel e editavel no sinistro

---

## Resumo de Prioridades

| Prioridade | Item | Impacto |
|------------|------|---------|
| ALTA | Corrigir URL params na pagina de OS | Fluxo Sinistro->OS quebrado |
| ALTA | Migracao SQL (status + campos) | Integridade de dados |
| MEDIA | Exibir novos campos na tela | UX completa |
| MEDIA | Validacao Perda Total | Regra de negocio |
| BAIXA | KPIs adicionais nos dashboards | Melhoria de gestao |
