
## Problema observado

Após o novo titular assinar o contrato e agendar a vistoria pelo link público da troca de titularidade:

1. **Nenhum serviço de campo apareceu para o Monitoramento** (Aba "Serviços de Campo" / "Aprovações de Associados") — não foi criado registro em `servicos`, `agendamentos_base` nem `vistorias` para o novo contrato.
2. **A cobertura ficou ativa antes da aprovação final do Monitoramento** — o veículo permaneceu com `cobertura_assistencia=true` e `status='ativo'` o tempo todo, herdado do contrato antigo, sem ser suspensa durante a transição.

## Causa raiz (verificada nos dados)

Caso real: `solicitacoes_troca_titularidade` `31330683…`, veículo `LTB4J74`, novo contrato `CTR-20260510232950-BAJR4X` (`status=assinado`, `tipo_entrada=troca_titularidade`).

- O contrato antigo (`CTR-20260510110501-ZFKTEX`) continua `status=ativo` e o veículo continua `status=ativo, cobertura_assistencia=true`. O hook "best-effort" em `contrato-gerar` que cancela contrato antigo + marca solicitação como `efetivada` rodou (`efetivada_em` está setado) mas a `efetivar-troca-titularidade` real (que faz a transferência completa, ASAAS, históricos, taxa) não foi disparada — então a cobertura jamais foi reciclada.
- Não existe nenhum `servicos`, `agendamentos_base` ou `vistorias` ligado ao veículo após o agendamento. A função `criar-instalacao-pos-pagamento` só cria serviço quando `contrato.adesao_paga=true && contrato.aprovado_em` — em troca de titularidade `valor_adesao=0` e o `aprovado_em` do contrato novo nunca é setado (a aprovação fica na `solicitacoes_troca_titularidade`, não no contrato).
- O fluxo de efetivação acontece **antes** do Monitoramento aprovar a vistoria de campo: a aprovação atual da solicitação é só documental. Não há serviço criado para o time de Monitoramento aprovar/recusar in loco.

## O que vamos fazer

### 1. Criar o serviço de campo automaticamente para troca de titularidade

Acrescentar bloco em `supabase/functions/contrato-gerar/index.ts` (ou logo após a assinatura no `autentique-webhook`) que, quando `tipo_entrada='troca_titularidade'` e o novo contrato é assinado:

- Cria 1 `servicos` (`tipo='vistoria'`, `origem='troca_titularidade'`, `status='pendente'`) ligado ao novo `contrato_id` + `veiculo_id` + `associado_id` do novo titular, copiando `data_agendada`/`periodo`/`endereço` da própria cotação (campos `vistoria_completa_*`) ou do agendamento público.
- Cria 1 `agendamentos_base` espelhado quando o agendamento for em base (idempotente por `cotacao_id`).
- Marca `solicitacoes_troca_titularidade.servico_vistoria_id` para a UI pública (`TelaAnaliseTrocaTitularidade`/timeline) refletir o status real.
- Tornar idempotente: não recriar se já existe `servicos` com `(cotacao_id, tipo='vistoria')`.

Isso faz o serviço aparecer em `Monitoramento › Serviços de Campo` e na fila `Aprovações de Associados`, exatamente como nas demais entradas (adesão, inclusão, substituição).

### 2. Suspender cobertura do veículo durante a troca

No momento em que o termo de cancelamento é assinado (`autentique-webhook`, hoje já marca `em_troca_titularidade=true`), também:

- Setar no veículo `cobertura_suspensa=true`, `cobertura_suspensa_em=now()`, `cobertura_suspensa_motivo='troca_titularidade_em_andamento'`.
- Manter `status='ativo'` (não muda) — só a flag de cobertura.

Na `efetivar-troca-titularidade`, ao concluir a transferência **e somente após Monitoramento aprovar o serviço de campo** (passo 3 abaixo), reativar:

- `cobertura_suspensa=false`, demais flags `cobertura_*` recalculadas a partir do plano do novo contrato.

### 3. Bloquear efetivação automática até o serviço de campo ser aprovado

- Remover/condicionar o "gancho best-effort" em `contrato-gerar` (linhas ~1286–1353) para NÃO marcar `solicitacoes_troca_titularidade.status='efetivada'` na hora da geração do contrato. A assinatura do contrato pelo novo titular deve apenas: criar o serviço (passo 1) e mover a solicitação para `aguardando_vistoria` (status já existente).
- A `efetivar-troca-titularidade` passa a ser disparada por trigger/edge function quando o serviço de vistoria for **aprovado pelo Monitoramento** (status `concluida` + `decisao_instalador='aprovado'`). Antes disso, o veículo continua suspenso e o contrato antigo continua ativo (sem cobrança nova).

### 4. Backfill do caso de teste atual

Migration única para o veículo `LTB4J74` (solicitação `31330683…`):
- Criar `servicos` de vistoria pendente para o novo contrato com data atual/agendada.
- Resetar `solicitacoes_troca_titularidade.status='aguardando_vistoria'`, `efetivada_em=null`.
- Suspender `cobertura_*` do veículo até a aprovação real.

### 5. UI

- `TelaAnaliseTrocaTitularidade`/`TimelineAprovacao`: passar a refletir o novo passo "Serviço de campo aprovado pelo Monitoramento" antes de "Troca efetivada".
- Badge no veículo (já existe `BadgeCobertura`): mostrar "Em transição (cobertura suspensa)" quando `em_troca_titularidade=true && cobertura_suspensa=true`.

## Arquivos afetados

- `supabase/functions/contrato-gerar/index.ts` — criar serviço + remover efetivação automática.
- `supabase/functions/autentique-webhook/index.ts` — suspender cobertura ao assinar termo.
- `supabase/functions/efetivar-troca-titularidade/index.ts` — disparar só após aprovação do serviço; reativar cobertura no fim.
- Nova migration:
  - Trigger (ou hook na edge `aprovar-servico-monitoramento`) para chamar `efetivar-troca-titularidade` quando o serviço de troca for aprovado.
  - Backfill do veículo `LTB4J74`.
- `src/components/troca-titularidade/TimelineAprovacao.tsx` — adicionar etapa "Vistoria aprovada pelo Monitoramento".

## Riscos / pontos de atenção

- Idempotência do hook em `contrato-gerar` (não criar 2 serviços se reentrante).
- Sincronização do veículo enquanto `em_troca_titularidade=true` (trigger `fn_sync_veiculo_associado_from_contrato` já respeita essa flag).
- Garantir que faturamento do contrato antigo continua até a efetivação real (não cancelar antes da aprovação do Monitoramento).
