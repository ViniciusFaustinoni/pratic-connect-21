
## Escopo (estritamente 2 casos)

Caso 1 — Adesão zerada no link público (`EtapaPagamentoCotacao.tsx`, 2 branches: agência-em-mãos linhas ~283-305 e adesão zerada genérica linhas ~306-340).
Caso 2 — Enqueue SGA em `useAprovacaoMonitoramento.ts` (~linha 345).

Fora de escopo: outros pontos com o mesmo cheiro, views/RLS das filas (item 2 da fila).

---

## Caso 1 — Edge `confirmar-adesao-zerada`

**Assinatura**

```
POST /functions/v1/confirmar-adesao-zerada
Body: {
  cotacao_id: string,                        // obrigatório
  origem: 'adesao_zerada' | 'agencia_em_maos' // obrigatório, vira log/auditoria
}
Response 200: {
  success: true,
  contrato_id: string,
  status_contratacao: 'pagamento_ok',
  instalacao_materializada: boolean,         // false se ainda não há agendamento (esperado nesta fase)
  idempotente: boolean                        // true se já estava em pagamento_ok
}
Response 4xx/5xx: {
  success: false,
  error: string,           // código curto: 'cotacao_nao_encontrada' | 'contrato_nao_encontrado' | 'adesao_nao_zerada' | 'transicao_invalida' | 'erro_interno'
  mensagem: string         // texto humano para exibir
}
```

**O que faz, server-authoritative e idempotente:**

1. Lê cotação + contrato com lock leve (`select ... for update` numa RPC `fn_confirmar_adesao_zerada`).
2. Valida `cotacoes.valor_adesao <= 0` OU origem agência (preserva regra atual). Se não, retorna 400 `adesao_nao_zerada`.
3. Marca `contratos.adesao_paga=true` (+ `adesao_isenta_agencia=true` quando `origem='agencia_em_maos'`).
4. Promove `cotacoes.status_contratacao` para `pagamento_ok` via CAS (`where status_contratacao in ('contrato_assinado','pagamento_ok')`). Idempotente.
5. Chama `criar-instalacao-pos-pagamento` internamente com `skipPaymentCheck:true`. Aceita o 400 atual `Dados de agendamento não encontrados` como **não-erro** (cliente ainda vai agendar) — apenas registra `instalacao_materializada=false`. Qualquer outro erro vira `error:'erro_interno'` e a transição NÃO é confirmada (rollback do passo 4 — daí precisar de RPC transacional).
6. Tudo dentro de uma RPC `fn_confirmar_adesao_zerada` (passos 3–4 atômicos). A invocação da edge interna fica fora da transação SQL mas dentro do try da edge: se falhar com erro real, edge retorna 5xx e cliente repete; se falhar com "sem agendamento" (esperado), edge retorna 200.
7. Log em `logs_auditoria` via `insertAuditLog` (acao `'criar'`, descrição `[CONFIRMAR_ADESAO_ZERADA] origem=...`).
8. Reentrante: se `status_contratacao` já estiver em `pagamento_ok` e `adesao_paga=true`, retorna `idempotente:true` sem reexecutar.

**Hardening UI — `EtapaPagamentoCotacao.tsx`:**

- Remove os dois blocos client-side (linhas ~283-305 e ~306-340) que faziam: marcar `adesao_paga`, invocar `criar-instalacao-pos-pagamento`, set "Parabéns".
- No lugar, uma única chamada `await publicSupabase.functions.invoke('confirmar-adesao-zerada', { body: { cotacao_id, origem } })`.
- Se `success:true` → `setMsgAdesaoZerada(msg)`, `setAdesaoZerada(true)`, `setEtapaInterna('pago')`, `setTimeout(onPagamentoConfirmado, 1500)`.
- Se `error` → NÃO chama `setAdesaoZerada(true)`. Mantém `etapaInterna='aguardando_pagamento'` e renderiza um Alert vermelho (shadcn `Alert` + `AlertCircle`) com o texto `mensagem` da edge + botão **"Tentar novamente"** que reexecuta `inicializar()`. Mensagens previsíveis:
  - `erro_interno` → "Não conseguimos confirmar sua adesão isenta agora. Tente novamente em instantes; se persistir, fale com o suporte."
  - `transicao_invalida` → "Esta cotação não está no estado esperado para confirmação automática. Recarregue a página."
- Nada de `try/catch` swallow: erro inesperado de rede também cai no mesmo Alert.

---

## Caso 2 — SGA enqueue dentro de `ativar-associado`

**Mudança na edge `ativar-associado`:**

Adiciona parâmetros opcionais no body:

```
sga_enqueue?: {
  enabled: true,
  status_sga_destino: 'ativo',
  force_resync_media: boolean,
  etapa_origem: string,           // ex: 'aprovacao_monitoramento'
  motivo_decisao: string
}
```

Comportamento:

1. Após o CAS bem-sucedido do associado/contrato/veículo (e antes do bloco de retorno `success:true`), se `sga_enqueue?.enabled === true` e `veiculo_id && associado_id`, executa o `enqueue_integration` que hoje vive no hook — mesmo `_correlation_id` determinístico para idempotência: `sga:hinova:<veiculo_id>:<etapa_origem>` (sem `Date.now()`, pra deixar idempotente entre retries).
2. O enqueue vira parte do conjunto de side-effects rastreado pelo mecanismo `parciais` já existente. Se o `enqueue_integration` falhar, adiciona `{alvo:'sga_enqueue', erro:...}` em `parciais` e a edge retorna 207 `promocao_parcial` (associado segue ativo, UI mostra "ativado pendente SGA — retentar"). Não criar coluna nova; o estado "ativado pendente SGA" é derivado da fila `sga_sync_queue` (ausência de registro pra esse veículo após ativação) + flag `parciais` no retorno.
3. Idempotente por natureza: `enqueue_integration` com mesmo `_correlation_id` já dedup. Reexecuções via retry do hook (botão "Reenviar para SGA") ou via o cron `cron-sga-retry` existente.

**Mudança em `useAprovacaoMonitoramento.ts`:**

- Remove o `await supabase.rpc('enqueue_integration', {...})` standalone (linhas ~340-358).
- Passa `sga_enqueue: { enabled:true, status_sga_destino:'ativo', force_resync_media:true, etapa_origem:'aprovacao_monitoramento', motivo_decisao:'Reenvio de fotos pós-vistoria após aprovação do monitoramento' }` no body da chamada `ativar-associado`.
- Se retorno vier `promocao_parcial` com `parciais` contendo `sga_enqueue`, o tratamento de erro existente (`err.code='promocao_parcial'` → toast já existe) cobre — só ajustar a mensagem para mencionar SGA quando `parciais` incluir `sga_enqueue`.

**Outros 6 callers de `ativar-associado`:** mantêm comportamento atual (não passam `sga_enqueue`). Esta rodada cobre apenas o caller do Monitoramento. Os outros já têm seus próprios pontos de enqueue (`aprovar-proposta`, `aprovar-troca-monitoramento`, `criar-instalacao-pos-pagamento`) ou não precisam.

---

## Arquivos tocados

- **NOVO** `supabase/functions/confirmar-adesao-zerada/index.ts`
- **NOVA RPC** `public.fn_confirmar_adesao_zerada(p_cotacao_id uuid, p_origem text)` (migration)
- `supabase/functions/ativar-associado/index.ts` (adiciona `sga_enqueue` opcional + `parciais`)
- `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx` (substitui 2 branches por 1 invoke + Alert de erro)
- `src/hooks/useAprovacaoMonitoramento.ts` (remove enqueue standalone, passa `sga_enqueue` no body)

Sem mudança em outros callers, sem migration de schema fora da nova RPC, sem mudança nas filas de Cadastro/Monitoramento (rodada 2).

---

## Pontos que respondo objetivamente ao seu pedido

1. **Nome/assinatura Caso 1:** `POST /confirmar-adesao-zerada`, body `{cotacao_id, origem:'adesao_zerada'|'agencia_em_maos'}`, retorna `{success, contrato_id, status_contratacao, instalacao_materializada, idempotente}` ou `{success:false, error, mensagem}`.

2. **SGA dentro do `ativar-associado`:** novo param opcional `sga_enqueue` no body. Enqueue roda após o CAS, com `_correlation_id` determinístico (sem timestamp). Falha de enqueue → entra no array `parciais` existente e a edge retorna 207 `promocao_parcial` — associado fica ativo localmente, sinalizado como "pendente SGA" via ausência na fila + flag no retorno. Sem coluna nova no banco.

3. **Erro real no `EtapaPagamentoCotacao`:** se a edge retornar `success:false`, NÃO seta `adesaoZerada=true`, mantém `etapaInterna='aguardando_pagamento'`, renderiza `<Alert variant="destructive">` com o texto `mensagem` da edge e um botão "Tentar novamente" que reexecuta o `inicializar()`. Sem mais `console.error` silencioso — qualquer throw cai no mesmo Alert com cópia genérica de retry.

Aprova que sigo pra build?
