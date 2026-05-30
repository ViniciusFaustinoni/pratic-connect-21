# ERRO 13 — Endurecer ativar-associado (documentação + alerta)

## Diagnóstico (estado atual)

`ativar-associado` já é o **único caminho canônico** para promover associado/contrato/veículo a `ativo` (regra de memória `mem://architecture/activation/single-source-activation`). Já tem:

- `pg_advisory_xact_lock` por `associado_id`
- CAS via `.in('status', allowed_from_assoc)` no UPDATE
- Coerção `aguardar_instalacao=true → cobertura flags=false`
- Guard de rastreador físico para Diesel / FIPE≥
- Log em `ativacao_status_log` com `source` (já preenchido por todos os callers)

O que **falta**: rastreabilidade explícita de quem pode chamar com qual `allowed_from`, e detecção quando dois callers diferentes batem no mesmo associado quase simultaneamente (sinal de race / lógica duplicada).

### Callers reais hoje (7, não 5)

| # | Caller | `source` | `allowed_from` |
|---|---|---|---|
| 1 | `aprovar-proposta` (edge) | `edge:aprovar-proposta` | `aguardando_instalacao, aguardando_aprovacao_monitoramento, em_analise, documentacao_pendente, aprovado` |
| 2 | `aprovar-troca-monitoramento` (edge) | `edge:aprovar-troca-monitoramento` | `assinado, aguardando_instalacao, pendente` |
| 3 | `criar-instalacao-pos-pagamento` (edge) | `edge:criar-instalacao-pos-pagamento` | default da edge |
| 4 | `reconciliar-contratos-pos-monitoramento` (cron) | `cron:reconciliar-contratos-pos-monitoramento` | `assinado, aguardando_instalacao, aguardando_aprovacao_monitoramento, em_analise, documentacao_pendente, aprovado` |
| 5 | `softruck-ativar-dispositivo` (edge) | `edge:softruck-ativar-dispositivo` | default da edge |
| 6 | `useAprovacaoMonitoramento` (hook UI) | `hook:useAprovacaoMonitoramento` | `assinado, aguardando_instalacao, pendente, em_analise, documentacao_pendente, aprovado` |
| 7 | `useVistoriaCompletaAnalise` (hook UI) | `hook:useVistoriaCompletaAnalise` | mesmo do anterior |

## Escopo da correção

Apenas observabilidade + documentação. **Sem mudança de regra funcional** — não vamos restringir `allowed_from` por caller agora (risco de quebrar fluxos válidos em produção).

### 1. Bloco de documentação canônica em `supabase/functions/ativar-associado/index.ts`

Comentário no topo do arquivo listando os 7 callers autorizados, em qual momento do fluxo cada um dispara e qual é o `allowed_from` esperado. Serve como referência única — qualquer caller novo deve aparecer aqui.

### 2. Alerta de ativação concorrente

Adicionar, logo após o INSERT em `ativacao_status_log`, uma checagem leve:

```text
SELECT source, created_at
FROM   ativacao_status_log
WHERE  associado_id = :assoc
  AND  to_status    = 'ativo'
  AND  created_at  >= now() - interval '5 minutes'
  AND  source <> :source_atual
ORDER  BY created_at DESC
LIMIT  1;
```

Se retornar linha, registrar:

- `console.warn('[ativar-associado][race] dupla ativação <5min', { associado_id, source_atual, source_anterior, gap_ms })`
- `logs_auditoria` com `acao='criar'` e descrição `[ATIVACAO_CONCORRENTE] {source_anterior} → {source_atual} em {gap_ms}ms` (passa pelo helper `insertAuditLog` para respeitar a regra `mem://logic/audit/logs-auditoria-vigia-universal`)

Não bloqueia a resposta — só sinaliza. O CAS+lock já garantem que a 2ª ativação é no-op idempotente; o alerta serve pra debugar e identificar caller redundante.

### 3. Sem migração de schema

`ativacao_status_log` já tem `source` e `created_at` — basta consultar.

## Arquivos tocados

- `supabase/functions/ativar-associado/index.ts` — comentário-cabeçalho com matriz de callers + query de detecção pós-INSERT do log

## Fora de escopo (registrar como dívida)

- Restringir `allowed_from` por caller (exige saneamento de dados em prod antes)
- Painel admin pra visualizar ativações concorrentes (sai do log via dashboard existente)
- Memória de projeto pra fixar a matriz de callers (sugiro criar `mem://architecture/activation/callers-matrix` depois que aprovar)
