## Estado atual da régua

O motor `executar-regua-cobranca` já cobre a maior parte do que você descreveu:

- ✅ Busca via `/listar/boleto-associado/periodo` (já fatia em janelas de 31 dias internamente)
- ✅ Identifica status PAGO / CANCELADO / VENCIDO / A VENCER (regex `SITUACAO_PAGA`/`SITUACAO_CANCELADA` + `data_pagamento`)
- ✅ Casa cada boleto não-pago com a etapa correspondente (D-N para lembretes, D+N para atrasados)
- ✅ Usa nome/celular/telefone fixo/comercial do retorno Hinova + fallback do mirror local
- ✅ Ordenação: inadimplentes mais antigos → maior valor → depois lembretes (mais próximos do vencimento primeiro)
- ✅ Delay configurável (default 10s, range 0–60s)
- ✅ Dedupe diário por `(nosso_numero, dia_regua)` em `cobranca_eventos`
- ✅ Worker em background (`EdgeRuntime.waitUntil`) com cancelamento via `cobranca_runs.status='cancelado'`

## Lacunas detectadas (vs. o que você pediu nas mensagens anteriores)

### 1. Janela de varredura ≠ "2 meses retroativos + mês atual"
Hoje a janela é derivada de `min/max(etapa.dias)` (`hoje - dMax` … `hoje - dMin`). Se as etapas configuradas forem curtas, perdemos boletos antigos que ainda estão em aberto e deveriam entrar na régua. Você pediu explicitamente uma janela mínima de **2 meses retroativos + mês atual**, independente das etapas.

**Correção**: forçar `inicioVenc = min(hoje - dMax, primeiroDiaDoMes(hoje - 2 meses))` e `fimVenc = max(hoje - dMin, últimoDiaDoMês(hoje))`. Isso garante que toda a janela de cobrança esteja coberta mesmo quando as etapas mudarem.

### 2. Mirror em `cobrancas` não está implementado
A régua hoje só grava em `cobranca_eventos`. Não há upsert na tabela `cobrancas` (insere novas, atualiza vencimento/status, baixa pagas) — o que você pediu para acontecer "diariamente, ao executar a régua".

**Correção**: criar helper compartilhado `_shared/cobrancas-sga-upsert.ts` (extraindo a lógica que já existe em `sga-sync-financeiro-veiculo`) e chamá-lo em `executar-regua-cobranca` logo após o fetch dos boletos, antes da fila de disparos. Chave: `(associado_id, nosso_numero)` com fallback `(associado_id, veiculo_id, data_vencimento, valor)`. Atualiza `valor_pago`, `data_pagamento`, `situacao_boleto`, `linha_digitavel`, `boleto_url`, `data_vencimento_original`, `dados_brutos_sga`, `sincronizado_sga_em` (janela de proteção 24h, conforme memória `mem://logic/billing/reconciliacao-csv-cobrancas`).

Adicionar contadores em `cobranca_runs.payload`: `cobrancas_inseridas`, `cobrancas_atualizadas`, `cobrancas_baixadas`, `cobrancas_ignoradas`.

### 3. Pequenos itens de consistência
- O cálculo `dataInicial` (linha 203) está duplicado/morto — sobrescrito por `inicioVenc` (linha 206). Limpar.
- O comentário do cabeçalho (linha 4) ainda diz "janela = etapas D-min..D+max" — atualizar para refletir a regra "2 meses + mês atual".
- Para `SITUACAO_PAGA`, considerar baixar a `cobrancas` correspondente (status='pago') mesmo quando `data_pagamento` vier nulo, evitando que a próxima rodada continue mirando boleto pago.

## O que NÃO precisa mudar

- Ordenação, dedupe, delay, worker em background, mapa de templates, pré-carregamento de slots — tudo isso já está correto e alinhado.
- Janelamento Hinova de 31 dias já é resolvido em `listarBoletosPorPeriodo` (auto-fatia).

## Detalhes técnicos das mudanças

**`supabase/functions/executar-regua-cobranca/index.ts`**
- Substituir cálculo de `inicioVenc`/`fimVenc` por união entre intervalo das etapas e "2 meses retroativos + mês atual".
- Após `listarBoletosPorPeriodo`, chamar `await mirrorBoletosEmCobrancas(supabase, boletos)` (novo helper) e somar contadores ao `payload` do run.
- Remover linha morta de `dataInicial` e atualizar o cabeçalho do arquivo.

**`supabase/functions/_shared/cobrancas-sga-upsert.ts`** (novo)
- Função pura `mirrorBoletosEmCobrancas(supabase, boletos): Promise<{ inseridas, atualizadas, baixadas, ignoradas }>`.
- Reaproveita lógica de upsert atualmente embutida em `sga-sync-financeiro-veiculo`.

**`supabase/functions/sga-sync-financeiro-veiculo/index.ts`**
- Refatorar para consumir o novo helper, sem mudança de comportamento.

Sem alterações em UI, schema de `cobrancas`, cliente Hinova ou na fila de disparos.