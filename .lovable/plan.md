# Destravar a placa quando o antigo titular assina o termo de cancelamento

## Problema

Hoje, quando o antigo titular assina o termo de cancelamento da troca de titularidade, o webhook do Autentique apenas marca `solicitacoes_troca_titularidade.termo_cancelamento_assinado_em` e enfileira débitos. **O veículo continua vinculado ao antigo associado** até a `efetivar-troca-titularidade` rodar (depois de aprovação de cadastro + monitoramento + vistoria).

Resultado: quando o NOVO titular acessa o link público para gerar o contrato, `contrato-gerar` bate no bloqueio anti-sequestro (`PLACA_DE_OUTRO_ASSOCIADO`, HTTP 409) e trava o fluxo — placa "sequestrada".

## Decisão

Você escolheu "desvincular o veículo já na assinatura do termo". Tecnicamente, `veiculos.associado_id` é **NOT NULL** e existe um trigger que mantém `veiculos.associado_id == contratos.associado_id`. Zerar o FK literalmente quebraria essas invariantes e várias queries (cobrança, SGA, listagens) antes da efetivação real.

A solução entrega o efeito desejado (placa liberada para o novo titular) sem quebrar o ecossistema, marcando o veículo como "em troca" e ensinando o bloqueio anti-sequestro a respeitar essa marca.

## O que vai mudar

### 1. Schema — marcar veículo como "em troca de titularidade"
Adicionar em `veiculos`:
- `em_troca_titularidade boolean NOT NULL DEFAULT false`
- `troca_titularidade_id uuid` (FK para `solicitacoes_troca_titularidade.id`)
- `troca_titularidade_iniciada_em timestamptz`

Índice parcial em `(placa) WHERE em_troca_titularidade = true` para lookup rápido.

### 2. Webhook do Autentique — disparar ao assinar termo de cancelamento
Em `supabase/functions/autentique-webhook/index.ts` (no bloco já existente do termo de cancelamento de troca, ~linhas 308–369), adicionar:
- `UPDATE veiculos SET em_troca_titularidade=true, troca_titularidade_id=<sol.id>, troca_titularidade_iniciada_em=now() WHERE id = solTroca.veiculo_id`
- Log claro: "Veículo X desvinculado logicamente do antigo titular Y para troca Z"

Idempotente (só executa quando `wasSigned && !termo_cancelamento_assinado_em`).

### 3. `contrato-gerar` — relaxar bloqueio anti-sequestro
Nas 3 ocorrências do bloqueio (linhas ~533, ~660, ~786), antes de retornar 409 `PLACA_DE_OUTRO_ASSOCIADO`, checar:
- Se `veiculos.em_troca_titularidade = true` E a `cotacao.id` está vinculada a essa `solicitacoes_troca_titularidade` (via `troca_titularidade_id` ou `dados_extras->>'solicitacao_troca_id'`) → **permitir prosseguir**.
- Caso contrário → manter o 409 (proteção real).

### 4. `efetivar-troca-titularidade` — limpar a flag ao concluir
No `UPDATE veiculos` que transfere para o novo associado (linha ~317), também zerar:
- `em_troca_titularidade = false`
- `troca_titularidade_id = NULL`
- `troca_titularidade_iniciada_em = NULL`

### 5. UI — badge no veículo
Em listagens/detalhes do veículo do antigo titular, mostrar badge "Em Troca de Titularidade" quando `em_troca_titularidade = true` (não-bloqueante; só sinaliza).

### 6. Memória
Atualizar `mem://constraints/contracts/no-cross-owner-vehicle-reuse` e `mem://logic/contracts/veiculo-associado-sync-trigger` com a exceção da flag `em_troca_titularidade`.

## O que NÃO muda (intencional)

- **Cobertura/SGA do antigo titular continua ativa** até a `efetivar-troca-titularidade` rodar. Isso é correto: ele ainda paga até a efetivação real e não pode ficar sem cobertura no intervalo.
- O contrato antigo só é encerrado em `efetivar-troca-titularidade` (já hoje).
- O bloqueio real anti-sequestro continua funcionando para qualquer placa que NÃO esteja em troca legítima.

## Backfill

Para a solicitação atual em teste (`COT-20260510-0010`), aplicar o `UPDATE veiculos` manualmente na migração para destravar imediatamente.

## Arquivos afetados

- Migration nova: colunas + índice + backfill
- `supabase/functions/autentique-webhook/index.ts`
- `supabase/functions/contrato-gerar/index.ts`
- `supabase/functions/efetivar-troca-titularidade/index.ts`
- 1 componente de UI (badge)
- Memórias atualizadas
