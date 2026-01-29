
# Plano de Revisao dos Modulos Financeiros

## Analise Comparativa: PDF vs Codigo Atual

Apos revisar detalhadamente o documento "MODULOS FINANCEIROS - SGA Pratic 2.0" e comparar com o codigo existente, identifiquei os gaps e melhorias necessarias para alinhar os tres modulos (Financeiro, Cobranca e Contabilidade).

---

## RESUMO EXECUTIVO

### Status Geral por Modulo

| Modulo | Conformidade | Gaps Identificados |
|--------|--------------|-------------------|
| FINANCEIRO | 70% | Falta saldo por conta, grafico de fluxo, checkbox em lote |
| COBRANCA | 80% | Falta KPI recuperacao, negativacao lote, modo trabalho |
| CONTABILIDADE | 85% | Falta balancete detalhado, razao da conta |

---

## MODULO FINANCEIRO - Gaps e Implementacoes

### 1. Dashboard Financeiro
**Arquivo:** `src/pages/financeiro/FinanceiroDashboard.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Card "Saldo Atual" com modal detalhado | Parcial | Adicionar modal com saldo por conta |
| Grafico barras Fluxo Caixa 30 dias | Placeholder | Implementar grafico real com recharts |
| Lista Contas a Receber por vencimento | Ausente | Adicionar componente lateral |
| Cards Saldo por Conta Bancaria | Ausente | Adicionar grid de cards por conta |

**Alteracoes:**
- Adicionar query para buscar saldo de cada conta bancaria
- Criar modal "Saldo por Conta" ao clicar no card Saldo Atual
- Substituir placeholder por grafico de barras real (entradas verdes, saidas vermelhas)
- Adicionar lista de contas a receber agrupadas por periodo (Hoje, Amanha, Esta semana)

### 2. Lista de Cobrancas (Recebimentos)
**Arquivo:** `src/pages/financeiro/CobrancasList.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Checkbox para selecao em lote | Ausente | Adicionar coluna checkbox |
| Acoes em lote (Enviar Boletos, WhatsApp, Email) | Ausente | Adicionar barra de acoes |
| Botao "Reemitir" para boletos | Ausente | Adicionar no dropdown de acoes |

**Alteracoes:**
- Adicionar estado `selectedItems` para controle de selecao
- Adicionar coluna checkbox na tabela
- Criar barra de acoes em lote quando houver itens selecionados
- Adicionar botao "Reemitir" no menu de acoes

### 3. Detalhe da Cobranca
**Arquivo:** `src/pages/financeiro/CobrancaDetalhe.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Secao Associado com link "Ver Cadastro" | Parcial | Adicionar botao navegacao |
| Secao Pagamento (quando pago) | Parcial | Expandir informacoes |
| Secao Historico (timeline eventos) | Ausente | Criar timeline de eventos |

### 4. Contas a Pagar
**Arquivo:** `src/pages/financeiro/ContasPagar.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Checkbox para selecao em lote | Ausente | Adicionar coluna checkbox |
| Pagamento em lote | Ausente | Criar modal pagamento multiplo |
| Vinculo a Sinistro/OS | Ausente | Adicionar campo no modal criacao |
| Recorrencia (mensal) | Ausente | Adicionar opcao no modal |
| Anexo Nota Fiscal | Ausente | Adicionar upload de anexo |

**Alteracoes:**
- Adicionar checkbox e barra de acoes em lote
- Criar campos de vinculo (sinistro_id, os_id) no modal NovaContaPagarModal
- Adicionar secao de recorrencia (pagamento unico vs mensal)
- Integrar upload de anexo ao bucket 'documentos'

### 5. Faturamento
**Arquivo:** `src/pages/financeiro/FaturamentoMensal.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Card Configuracoes Faturamento | Ausente | Adicionar card com settings |
| Modal Progresso com barra | Parcial | Melhorar feedback visual |
| Opcao "Refaturar especificos" | Ausente | Adicionar filtro de associados |

### 6. Extratos Bancarios
**Arquivo:** `src/pages/financeiro/ExtratosBancarios.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Card Pendencias por conta | Parcial | Melhorar visualizacao |
| Modal Conciliacao com sugestoes | Ausente | Criar modal inteligente |

---

## MODULO COBRANCA - Gaps e Implementacoes

### 1. Dashboard Cobranca
**Arquivo:** `src/pages/cobranca/CobrancaDashboard.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| KPI "Recuperado Este Mes" | Ausente | Adicionar card com valor |
| KPI "Taxa Recuperacao" | Ausente | Calcular % de sucesso |
| Grafico Evolucao Mensal | Ausente | Adicionar grafico de linha |

**Alteracoes:**
- Adicionar query para calcular valor recuperado (acordos pagos + boletos vencidos pagos)
- Calcular taxa de recuperacao = recuperado / valor_total_inadimplencia
- Implementar grafico de linha mostrando evolucao mes a mes

### 2. Lista Inadimplentes
**Arquivo:** `src/pages/cobranca/InadimplentesList.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Status de Cobranca (Email, WhatsApp, Em negociacao) | Ausente | Adicionar coluna status |
| Acoes em lote (WhatsApp, Email, Adicionar a Fila) | Parcial | Expandir acoes |
| Botao "Negativar" | Ausente | Adicionar no menu de acoes |

### 3. Fila de Trabalho
**Arquivo:** `src/pages/cobranca/FilaTrabalho.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Modal "Modo Trabalho" com roteiro | Ausente | Criar modal completo |
| Roteiro de ligacao com script | Ausente | Adicionar texto sugerido |
| Resultados da ligacao (atendeu, nao atendeu, etc) | Ausente | Adicionar opcoes de resultado |
| Reagendamento com data/hora | Ausente | Adicionar campo data |

**Alteracoes:**
- Criar componente `ModoTrabalhoModal` com:
  - Cabecalho mostrando "Acao #X de Y"
  - Dados do associado e divida
  - Roteiro de ligacao sugerido
  - Radio buttons para resultado
  - Campo de observacao
  - Botao "Proximo" e "Pular"

### 4. Acordos
**Arquivo:** `src/pages/cobranca/NovoAcordo.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Calculo automatico juros/multa | Verificar | Implementar se ausente |
| Desconto maximo configuravel | Ausente | Adicionar validacao |
| Regras do acordo (quebrar se atrasar) | Ausente | Adicionar checkboxes |

### 5. Negativacao
**Arquivo:** `src/pages/cobranca/Negativacao.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Tabs: Negativados, Aptos, Historico | Verificar | Implementar se ausente |
| Confirmacao com digitacao "NEGATIVAR" | Ausente | Adicionar validacao |
| Negativacao em lote | Ausente | Adicionar funcionalidade |

### 6. Regua de Cobranca
**Arquivo:** `src/pages/cobranca/ReguaCobranca.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Visualizacao timeline | OK | Ja implementado |
| Editor de templates | Parcial | Melhorar preview |
| Status ativo/pausado global | Ausente | Adicionar toggle no header |

---

## MODULO CONTABILIDADE - Gaps e Implementacoes

### 1. Dashboard Contabilidade
**Arquivo:** `src/pages/contabilidade/ContabilidadeDashboard.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| KPI "Lancamentos Pendentes" | Ausente | Adicionar contagem |
| Grafico Evolucao Mensal | Ausente | Adicionar grafico de linha |
| Status dos Periodos (ultimos 3) | OK | Ja implementado |

### 2. Plano de Contas
**Arquivo:** `src/pages/contabilidade/PlanoContas.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Arvore hierarquica | OK | Ja implementado |
| Botao [+] para adicionar filho | OK | Ja implementado |
| Vinculo Conta Bancaria | Verificar | Adicionar se ausente |

### 3. Lancamentos
**Arquivo:** `src/pages/contabilidade/LancamentosList.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Filtro por Conta do Plano | Ausente | Adicionar campo busca |
| Totais Debito/Credito no header | Ausente | Adicionar resumo |

### 4. Novo Lancamento
**Arquivo:** `src/pages/contabilidade/NovoLancamento.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Editor de partidas multiplas | Verificar | Confirmar funcionamento |
| Validacao balanceado | Verificar | Confirmar |
| Indicador visual D = C | Verificar | Adicionar badge |

### 5. Balancete
**Arquivo:** `src/pages/contabilidade/Balancete.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Nivel de detalhe (sintetico/analitico) | Verificar | Adicionar toggle |
| Exportacao Excel | Verificar | Confirmar |

### 6. Razao da Conta
**Arquivo:** `src/pages/contabilidade/RazaoConta.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Busca por conta | Verificar | Confirmar |
| Saldo acumulado por linha | Verificar | Confirmar |

### 7. Fechamento
**Arquivo:** `src/pages/contabilidade/Fechamentos.tsx`

| Item PRD | Status Atual | Acao |
|----------|--------------|------|
| Checklist pre-fechamento | Parcial | Expandir verificacoes |
| Botao Reabrir periodo | Ausente | Adicionar funcionalidade |

---

## INTEGRACAO ENTRE MODULOS

### Fluxo 1: Pagamento de Mensalidade
**Implementar automacao:**
1. Webhook ASAAS atualiza cobranca para "Pago"
2. Registrar entrada no extrato (`movimentacoes_financeiras`)
3. Creditar na conta bancaria (`contas_bancarias.saldo_atual`)
4. Remover da lista de inadimplentes (se estava)
5. Cancelar acoes pendentes da regua
6. Criar lancamento contabil automatico

### Fluxo 2: Cobranca Vencida
**Verificar automacao existente:**
1. Status muda para "Vencida" (webhook ou cron)
2. Adiciona a lista de inadimplentes
3. Regua inicia automaticamente

### Fluxo 3: Acordo de Divida
**Implementar:**
1. Ao criar acordo, pausar regua para o associado
2. Gerar cobrancas do acordo no ASAAS
3. Ao pagar parcela, atualizar progresso
4. Ao quitar, remover da inadimplencia
5. Criar lancamento contabil de "recuperacao"

### Fluxo 4: Pagamento de Oficina
**Implementar:**
1. Ao concluir OS, criar conta a pagar vinculada
2. Ao pagar, debitar conta bancaria
3. Criar lancamento contabil (Despesa Sinistros)

---

## ARQUIVOS A MODIFICAR

### Modulo Financeiro
| Arquivo | Alteracoes |
|---------|-----------|
| `FinanceiroDashboard.tsx` | Grafico fluxo caixa, modal saldo por conta, lista a receber |
| `CobrancasList.tsx` | Checkbox lote, acoes em lote, reemitir |
| `CobrancaDetalhe.tsx` | Timeline historico, secao pagamento expandida |
| `ContasPagar.tsx` | Checkbox lote, vinculo sinistro/OS, recorrencia, anexo |
| `NovaContaPagarModal.tsx` | Campos vinculo, recorrencia, anexo |
| `FaturamentoMensal.tsx` | Card configuracoes, refaturar especificos |
| `ExtratosBancarios.tsx` | Modal conciliacao inteligente |

### Modulo Cobranca
| Arquivo | Alteracoes |
|---------|-----------|
| `CobrancaDashboard.tsx` | KPIs recuperacao, grafico evolucao |
| `InadimplentesList.tsx` | Coluna status cobranca, acoes lote |
| `FilaTrabalho.tsx` | Modal modo trabalho com roteiro |
| `NovoAcordo.tsx` | Regras acordo, desconto maximo |
| `Negativacao.tsx` | Tabs, confirmacao, lote |

### Modulo Contabilidade
| Arquivo | Alteracoes |
|---------|-----------|
| `ContabilidadeDashboard.tsx` | KPI pendentes, grafico evolucao |
| `LancamentosList.tsx` | Filtro conta, totais |
| `Balancete.tsx` | Toggle detalhe, exportacao |
| `Fechamentos.tsx` | Botao reabrir |

---

## PRIORIDADES DE IMPLEMENTACAO

### Fase 1 - Essencial (Esta sessao)
1. Dashboard Financeiro: Grafico fluxo caixa + saldo por conta
2. Cobrancas em lote: Checkbox + acoes
3. Contas a Pagar em lote: Checkbox + acoes
4. Dashboard Cobranca: KPIs recuperacao

### Fase 2 - Importante
1. Modo Trabalho na Fila de Cobranca
2. Modal conciliacao inteligente
3. Negativacao em lote
4. Acordos com regras

### Fase 3 - Melhorias
1. Timeline historico cobrancas
2. Vinculo sinistro/OS nas despesas
3. Recorrencia em contas a pagar
4. Reabrir periodo contabil

---

## DETALHES TECNICOS

### Query Saldo por Conta Bancaria
```sql
SELECT id, banco_nome, agencia, conta, saldo_atual
FROM contas_bancarias
WHERE ativo = true
ORDER BY banco_nome
```

### Calculo Valor Recuperado (Cobranca)
```sql
-- Boletos vencidos que foram pagos no mes
SELECT SUM(pagamento_valor)
FROM asaas_cobrancas
WHERE status IN ('RECEIVED', 'CONFIRMED')
  AND pagamento_data >= inicio_mes
  AND pagamento_data < fim_mes
  AND data_vencimento < pagamento_data
```

### Estrutura Modal Modo Trabalho
```text
+------------------------------------------+
| ACAO DE COBRANCA - Ligacao #1 de 45      |
|                              [Pular] [X] |
+------------------------------------------+
| ASSOCIADO                                |
| Nome: Joao Silva                         |
| Telefone: (21) 99999-9999  [Copiar][Lig] |
+------------------------------------------+
| DIVIDA                                   |
| 3 parcelas | 45 dias | R$ 569,70         |
+------------------------------------------+
| ROTEIRO                                  |
| "Ola, bom dia! Aqui e [nome] da..."     |
+------------------------------------------+
| RESULTADO                                |
| ( ) Atendeu - vai pagar                  |
| ( ) Atendeu - quer acordo                |
| ( ) Nao atendeu                          |
| ( ) Pediu para ligar depois [__/__]      |
|                                          |
| Observacoes: [________________]          |
+------------------------------------------+
|        [Propor Acordo] [Proximo]         |
+------------------------------------------+
```

