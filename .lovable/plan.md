
# Fase 3-5: Dashboard Enriquecido, Timeline Unificada e Melhorias

## Resumo

Implementar os Gaps 1, 2, 3 e 6 em uma unica rodada, enriquecendo o Dashboard, a lista de Inadimplentes, o Detalhe do Inadimplente e a Negativacao.

---

## 1. Dashboard de Cobranca (Gap 1) — `CobrancaDashboard.tsx`

### KPIs adicionais (de 4 para 8 cards)
Adicionar 4 novos KPIs ao grid existente:
- **Negativados**: count de `negativacoes` com status `negativado`
- **Na Fila Hoje**: count de `cobranca_fila` pendentes com `data_agendamento <= hoje`
- **Contatos Hoje**: count de `cobranca_contatos` com `created_at >= hoje` + barra de progresso (meta 30)
- **Taxa de Recuperacao**: percentual do valor recuperado no mes (pagamentos de cobrancas que estavam vencidas)

### Graficos novos
- **Inadimplencia por Faixa (6 meses)** — `BarChart` empilhado com 5 faixas (1-5d, 6-30d, 31-60d, 61-90d, 90+d). Busca `cobrancas` vencidas dos ultimos 6 meses e agrupa por faixa e mes.
- **Recuperacao Mensal (12 meses)** — `LineChart` com duas linhas: valor que entrou em inadimplencia vs valor recuperado por mes.
- **Efetividade da Regua (funil)** — grafico de funil simplificado mostrando: WhatsApp enviados > Ligacoes atendidas > Acordos feitos > Negativados > Judicial. Dados de `cobranca_contatos` e `negativacoes`.

### Top 10 Maiores Devedores
Secao de cards com os 10 associados com maior valor em aberto, com acoes rapidas (ver detalhe, WhatsApp, acordo).

### Alertas
Secao de alertas coloridos:
- Vermelho: 90+ dias sem contato, acordos quebrados
- Amarelo: completando 30 dias (candidatos SPC), parcelas vencendo hoje

**Componentes a criar:**
- `src/components/cobranca/DashboardGraficos.tsx` — graficos de inadimplencia por faixa, recuperacao mensal e funil
- `src/components/cobranca/TopDevedores.tsx` — top 10 maiores devedores
- `src/components/cobranca/AlertasCobranca.tsx` — alertas vermelho/amarelo

**Arquivo a modificar:**
- `src/pages/cobranca/CobrancaDashboard.tsx` — expandir grid de KPIs e adicionar novos componentes

---

## 2. Lista de Inadimplentes (Gap 2) — `InadimplentesList.tsx`

### Faixa 1-5 dias
Adicionar 5o card de faixa "1-5 dias" (azul) e separar a faixa "ate 30" em "1-5d" e "6-30d". Adicionar filtro correspondente.

### Colunas novas na tabela
- **Status na Regua**: badge com status derivado (WhatsApp automatico, Aguardando ligacao, Em negociacao, Acordo ativo, Negativado). Calculado cruzando `cobranca_fila`, `acordos` e `negativacoes`.
- **Situacao**: badge do status do associado (Ativo/Suspenso, Em acordo, Negativado, Excluido)

### Filtros adicionais
- Com/sem contato recente (7 dias)
- Com/sem acordo ativo
- Negativado/nao negativado

---

## 3. Detalhe do Inadimplente (Gap 3) — `InadimplenteDetalhe.tsx`

### Migracao de banco: tabela `cobranca_eventos`
Criar tabela para registrar TODOS os eventos (automaticos e manuais):

```sql
CREATE TABLE cobranca_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID NOT NULL REFERENCES associados(id),
  tipo TEXT NOT NULL, -- 'sistema', 'whatsapp', 'email', 'sms', 'ligacao', 'acordo', 'negativacao', 'status'
  subtipo TEXT, -- 'enviado', 'recebido', 'criado', 'pago', 'quebrado', 'suspensao', etc.
  descricao TEXT NOT NULL,
  dados JSONB DEFAULT '{}',
  criado_por UUID REFERENCES profiles(id),
  automatico BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cobranca_eventos_associado ON cobranca_eventos(associado_id);
CREATE INDEX idx_cobranca_eventos_created ON cobranca_eventos(created_at DESC);

ALTER TABLE cobranca_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados podem ver eventos" ON cobranca_eventos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados podem criar eventos" ON cobranca_eventos
  FOR INSERT TO authenticated WITH CHECK (true);
```

### Timeline Unificada
Substituir a `TimelineContatos` atual por uma timeline que busca de `cobranca_eventos` E `cobranca_contatos`, unificando tudo em ordem cronologica. Cada evento mostra:
- Icone por tipo (sistema=engrenagem, whatsapp=verde, email=roxo, ligacao=amarelo, acordo=azul, negativacao=vermelho)
- Data/hora
- Descricao
- Badge "Automatico" ou nome do atendente
- Dados extras (valor prometido, data prometida, etc.)

**Componente a criar:** `src/components/cobranca/TimelineUnificada.tsx`

### Botoes de acao adicionais
- **Gerar 2a Via**: calcula multa (2%) + juros pro rata e gera link de pagamento atualizado
- **Excluir do Quadro**: modal com confirmacao + motivo, cria solicitacao de aprovacao para diretoria
- **Encaminhar Juridico**: cria registro na tabela de casos juridicos (se existir) ou registra evento

### Calculo de multa e juros nos boletos
No card "Boletos em Atraso", adicionar coluna "Valor Atualizado" com: valor_original + 2% multa + juros de 1% ao mes pro rata.

---

## 4. Negativacao Safeguards (Gap 6) — `Negativacao.tsx`

### Validacao de pre-requisitos
Antes de permitir negativacao, verificar:
- Pelo menos 1 contato registrado em `cobranca_contatos` (whatsapp ou ligacao)
- Valor minimo configuravel (default R$ 200)
- Dias de atraso >= 30

Se nao atender, mostrar mensagem explicativa e bloquear o botao.

### KPIs adicionais
- **Baixas Pendentes**: negativacoes com `data_baixa IS NULL` e associado ja pagou. Alerta vermelho se > 3 dias uteis.
- **Negativados que Pagaram**: count de negativacoes baixadas no mes (efetividade)

### Alerta de prazo legal
Banner vermelho no topo quando existem baixas pendentes ha mais de 3 dias uteis (risco de multa legal).

---

## Arquivos a criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/cobranca/DashboardGraficos.tsx` | Graficos: faixa 6 meses, recuperacao 12 meses, funil |
| `src/components/cobranca/TopDevedores.tsx` | Top 10 maiores devedores |
| `src/components/cobranca/AlertasCobranca.tsx` | Alertas vermelho/amarelo |
| `src/components/cobranca/TimelineUnificada.tsx` | Timeline de todos os eventos |

## Arquivos a modificar

| Arquivo | Mudancas |
|---------|----------|
| `src/pages/cobranca/CobrancaDashboard.tsx` | 8 KPIs + novos componentes |
| `src/pages/cobranca/InadimplentesList.tsx` | Faixa 1-5d + colunas status/situacao + filtros |
| `src/pages/cobranca/InadimplenteDetalhe.tsx` | Timeline unificada + botoes + multa/juros |
| `src/pages/cobranca/Negativacao.tsx` | Validacoes + KPIs + alerta legal |

## Migracao de banco

Uma migracao criando a tabela `cobranca_eventos` com indices e RLS.

## Detalhes tecnicos

- Graficos usam `recharts` (BarChart, LineChart, PieChart)
- Timeline unificada busca de `cobranca_eventos` + `cobranca_contatos` e merge no frontend com `useMemo`
- Calculo de multa/juros: `multa = valor * 0.02`, `juros = valor * 0.01 * (diasAtraso / 30)`
- Validacao de negativacao busca `cobranca_contatos` do associado para verificar pre-requisitos
- Todos os componentes com skeleton loading
