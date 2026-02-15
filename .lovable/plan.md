
# Analise Completa: Modulo de Cobranca — Estado Atual vs Especificacao

## O que ja existe (implementado)

O modulo de cobranca ja possui uma base solida com as seguintes telas e funcionalidades:

### Telas existentes
| Tela | Arquivo | Status |
|------|---------|--------|
| Dashboard de Cobranca | `CobrancaDashboard.tsx` | Funcional |
| Lista de Inadimplentes | `InadimplentesList.tsx` | Funcional |
| Detalhe do Inadimplente | `InadimplenteDetalhe.tsx` | Funcional |
| Fila de Trabalho | `FilaTrabalho.tsx` | Funcional |
| Regua de Cobranca | `ReguaCobranca.tsx` | Funcional |
| Negativacao | `Negativacao.tsx` | Funcional |
| Lista de Acordos | `AcordosList.tsx` | Funcional |
| Novo Acordo | `NovoAcordo.tsx` | Funcional |
| Detalhe do Acordo | `AcordoDetalhe.tsx` | Funcional |

### Componentes auxiliares existentes
- `CardInadimplente.tsx` — card de inadimplente
- `RecuperacaoKPIs.tsx` — KPIs de recuperacao com grafico de evolucao
- `ModoTrabalhoModal.tsx` — modo de trabalho focado com roteiro de ligacao
- `RegistrarContatoModal.tsx` — modal para registrar contatos
- `RegistrarPagamentoParcelaModal.tsx` — modal para pagamento de parcela
- `CancelarAcordoModal.tsx` — modal para cancelar acordo
- `ConfirmarNegativacaoModal.tsx` — modal de confirmacao de negativacao
- `BaixarNegativacaoModal.tsx` — modal para baixa de negativacao
- `TimelineContatos.tsx` — timeline de contatos

### Tabelas de banco existentes
- `cobrancas` — boletos/cobrancas
- `cobranca_fila` — fila de trabalho
- `cobranca_contatos` — historico de contatos
- `acordos` — acordos de parcelamento
- `acordo_parcelas` — parcelas dos acordos
- `negativacoes` — registros de negativacao
- `reguas_cobranca` — configuracao de regua

---

## Gaps identificados (o que falta para atender 100% da especificacao)

### GAP 1 — Dashboard: KPIs faltantes e graficos

**Situacao atual:** 4 KPIs basicos (inadimplentes, valor em atraso, boletos vencidos, acordos ativos) + KPIs de recuperacao + grafico de evolucao 6 meses + faixas de atraso.

**O que falta:**
- KPI "Negativados" (quantidade ativa)
- KPI "Na Fila Hoje" (tarefas para hoje)
- KPI "Ligacoes/Contatos Hoje" (meta 30/dia com progresso)
- Grafico de barras empilhadas "Inadimplencia por Faixa" (6 meses, com faixa 1-5 dias)
- Grafico de funil "Efetividade da Regua" (% pagou apos WhatsApp, apos ligacao, apos acordo, negativado, judicial)
- Secao "Top 10 Maiores Devedores" com cards e acoes rapidas
- Alertas coloridos (vermelho: 90+ sem contato, acordos quebrados; amarelo: completando 30 dias, 120 dias, parcelas vencendo hoje)

**Prioridade:** Media. O dashboard funciona, mas faltam metricas estrategicas.

### GAP 2 — Inadimplentes: faixa 1-5 dias e status na regua

**Situacao atual:** 4 faixas (ate 30, 31-60, 61-90, 90+). Sem coluna "Status na Regua" nem "Situacao do Associado".

**O que falta:**
- Adicionar faixa "1-5 dias" (periodo de graca) separada
- Coluna "Status na Regua" (WhatsApp automatico, Aguardando ligacao, Em negociacao, Acordo ativo, Negativado, Cobranca judicial)
- Coluna "Situacao" (Ativo/Suspenso, Em acordo, Negativado, Excluido)
- Filtro por "com/sem contato recente", "negativado/nao negativado", "com/sem acordo"

**Prioridade:** Media.

### GAP 3 — Detalhe do Inadimplente: timeline enriquecida

**Situacao atual:** Mostra dados do associado, boletos vencidos, historico de contatos, acordos. Timeline basica de contatos.

**O que falta:**
- Timeline unificada incluindo TODOS os eventos (suspensao automatica, WhatsApp automatico, emails, mudancas de status, negativacao, acordo criado/pago/quebrado) — hoje so mostra contatos manuais
- Botao "Gerar 2a Via" (com multa e juros calculados)
- Botao "Encaminhar Juridico" (cria caso no modulo Juridico)
- Botao "Excluir do Quadro" (com aprovacao da diretoria)
- Calculo de multa + juros legais (2% multa + juros pro rata) no card de boletos

**Prioridade:** Alta. A timeline unificada e crucial para o operador ter contexto completo.

### GAP 4 — Fila de Trabalho: geracao automatica e barra de progresso

**Situacao atual:** Lista tarefas existentes, permite atender, modo trabalho funciona. Mas NAO gera tarefas automaticamente.

**O que falta:**
- Job/funcao que gera tarefas automaticamente com base na regua de cobranca (verifica cada inadimplente vs etapas da regua e cria tarefas na `cobranca_fila`)
- Barra de progresso visual do dia (concluidos/total)
- Meta diaria configuravel (30 contatos)
- Metricas do operador no rodape (tempo medio, taxa de contato efetivo, taxa de conversao)
- Acoes em lote funcionais (atribuir selecionados de fato)

**Prioridade:** Alta. Sem geracao automatica, a fila depende de insercao manual.

### GAP 5 — Acordos: regras de desconto e aprovacao

**Situacao atual:** Permite criar acordo com desconto livre, sem validacao de faixas nem fluxo de aprovacao.

**O que falta:**
- Validacao de faixas de desconto: ate 100% em juros/multa (automatico), ate 10% no principal (automatico), 11-20% (aprovacao Priscila), 20%+ (aprovacao Adriano)
- Limites: minimo 2 parcelas, maximo 12, valor minimo R$ 50/parcela
- Fluxo de aprovacao com notificacao
- Status "aguardando_aprovacao" para acordos que excedem o limite
- Envio da proposta por WhatsApp para o associado aceitar
- Deteccao automatica de acordo quebrado (parcela vencida ha 10 dias)
- Restauracao da divida original ao quebrar acordo (descontando o que ja foi pago)

**Prioridade:** Alta. Sem validacao, operador pode dar desconto excessivo.

### GAP 6 — Negativacao: prazo legal e integracao

**Situacao atual:** Permite negativar manualmente, tem tabs de negativados/pendentes/candidatos/baixados, negativacao em lote.

**O que falta:**
- Validacao de pre-requisitos antes de negativar (pelo menos 1 WhatsApp + 1 ligacao registrados, valor minimo configuravel)
- Prazo de 10 dias apos notificacao formal antes da efetivacao
- Alerta de baixas pendentes ha mais de 3 dias uteis (risco legal)
- KPI "Baixas Pendentes" com destaque de urgencia
- KPI "Negativados que Pagaram" (efetividade)
- Geracao de arquivo de remessa CNAB (para upload manual no SPC)
- Importacao de arquivo de retorno

**Prioridade:** Media. A negativacao manual funciona, mas faltam salvaguardas legais.

### GAP 7 — Regua de Cobranca: execucao automatica e metricas

**Situacao atual:** Permite configurar etapas (dia, acao, template, ativa/inativa) com timeline visual. Salva no banco. Mas NAO EXECUTA automaticamente.

**O que falta:**
- Edge function ou cron job que executa a regua diariamente (envia WhatsApp, cria tarefas na fila, suspende beneficios)
- Integracao com Evolution API para envio automatico de WhatsApp
- Integracao com Resend para envio de email
- Reguas multiplas (alto valor, associado antigo, reincidente) com criterios de selecao
- Metricas de efetividade por etapa (enviados, lidos, pagaram apos)
- Edicao de templates de mensagem com variaveis

**Prioridade:** Critica. E o "cerebro" do modulo — sem execucao automatica, toda a cobranca e manual.

### GAP 8 — Conexoes com outros modulos

**Situacao atual:** Modulo de cobranca opera de forma relativamente isolada.

**O que falta:**
- Cobranca -> Juridico: botao "Encaminhar Juridico" que cria caso no modulo juridico
- Cobranca -> Cadastro: ao excluir por inadimplencia, atualizar status e marcar veiculos/rastreadores
- Cobranca -> Eventos: consulta automatica de adimplencia na avaliacao de sinistros (parcialmente implementada no Gap 2 dos sinistros)
- Cobranca -> Monitoramento: notificar recolhimento de rastreador ao excluir
- Vendas -> Cobranca: bloqueio de nova adesao para ex-associados com debitos pendentes

**Prioridade:** Media. Cada integracao e independente.

---

## Plano de implementacao sugerido (por prioridade)

### Fase 1 — Execucao automatica da regua (Gap 7 parcial)
Criar edge function `executar-regua-cobranca` que roda diariamente via cron:
1. Busca todos os inadimplentes (boletos vencidos)
2. Para cada um, verifica em qual dia de atraso esta
3. Compara com as etapas ativas da regua
4. Para acoes automaticas (WhatsApp, SMS, email): executa via integracao existente
5. Para acoes manuais (ligacao): cria tarefa na `cobranca_fila`
6. Para acoes de sistema (suspensao): atualiza status do associado

### Fase 2 — Validacoes de acordos (Gap 5)
Adicionar validacoes no `NovoAcordo.tsx`:
1. Faixas de desconto com bloqueio/aprovacao
2. Limites de parcelas e valor minimo
3. Status "aguardando_aprovacao"
4. Deteccao de acordo quebrado (edge function)

### Fase 3 — Dashboard enriquecido (Gap 1)
Adicionar KPIs e graficos faltantes ao dashboard.

### Fase 4 — Timeline unificada (Gap 3)
Criar tabela `cobranca_eventos` para registrar todos os eventos automaticos e manuais. Unificar timeline no detalhe do inadimplente.

### Fase 5 — Salvaguardas de negativacao (Gap 6)
Adicionar validacoes, prazos e alertas.

### Fase 6 — Integracoes entre modulos (Gap 8)
Implementar progressivamente conforme necessidade.

---

## Decisao necessaria

Para prosseguir, e importante definir qual fase implementar primeiro. A Fase 1 (execucao automatica da regua) e a mais impactante pois automatiza 90% do trabalho de cobranca, mas tambem e a mais complexa. A Fase 2 (validacoes de acordos) e mais simples e resolve um risco financeiro imediato.

**Recomendacao:** Implementar na ordem Fase 2 -> Fase 1 -> Fase 3 -> Fase 4 -> Fase 5 -> Fase 6, pois a Fase 2 e rapida e resolve risco, enquanto a Fase 1 precisa de mais planejamento de integracao.
