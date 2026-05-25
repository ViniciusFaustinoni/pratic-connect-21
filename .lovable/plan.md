## Objetivo

Permitir cancelar a Substituição de Placa direto pelo `ModalDetalhesSubstituicao`, deixando a placa/associado livres para iniciar novos processos (nova substituição, troca, cotação avulsa) — sem apagar a solicitação, só marcando como `cancelada` e registrando em `logs_auditoria`.

## Comportamento

**Disponibilidade do botão** — só aparece quando `status` ∈ `aguardando_termo | termo_enviado | termo_assinado | cotacao_criada`. Em `efetivada` ou `cancelada` o botão não é exibido (substituição já consumada / já cancelada).

**Confirmação** — `AlertDialog` com:
- Aviso explicando que a operação será marcada como cancelada, a cotação vinculada (se houver e ainda não estiver assinada/paga) também será cancelada, e a placa volta a ficar disponível.
- Campo `motivo` (textarea opcional, máx 280 chars).

**Efeitos colaterais** (na ordem):
1. Se houver `cotacao_id` vinculada e a cotação ainda estiver em fase pré-assinatura (status_contratacao ∈ `lead, em_negociacao, aguardando_documentos, aguardando_termo, aguardando_pagamento`), marcar cotação como `cancelada` + `motivo_cancelamento='Substituição cancelada manualmente'`. Se a cotação já avançou (assinada / pagamento ok / cadastro / monitoramento / ativo), **bloquear o cancelamento** com mensagem orientando seguir o fluxo de cancelamento de contrato (a substituição não pode mais ser desfeita por aqui).
2. UPDATE em `solicitacoes_substituicao_placa`: `status='cancelada'`, `cancelada_em=now()`, `cancelada_por=auth.uid()`, `motivo_cancelamento=<input>`.
3. INSERT em `logs_auditoria` via helper `insertAuditLog` (entidade `solicitacao_substituicao`, ação `cancelar`, descrição com placa + motivo + cotacao_id afetada).
4. Não toca Autentique (termo de cancelamento legado, se enviado, expira naturalmente — não há risco porque só efeitos no banco contam).

**Liberação para novos processos** — como `criar-solicitacao-substituicao` só reaproveita solicitações com status `aguardando_termo | termo_enviado | termo_assinado | cotacao_criada`, marcar como `cancelada` já permite imediatamente uma nova substituição/troca para a mesma placa sem migration adicional.

## Implementação

**Nova edge function** `supabase/functions/cancelar-solicitacao-substituicao/index.ts`
- Body: `{ solicitacao_id: string, motivo?: string }`
- Service-role client + `auth.uid()` via header (padrão das demais).
- Faz as 3 etapas acima de forma sequencial; rollback nominal só logado (sem transação cross-tabela, mas idempotente — segundo cancelamento devolve `200 { ja_cancelada: true }`).
- Migration de schema: adicionar colunas `cancelada_em timestamptz`, `cancelada_por uuid`, `motivo_cancelamento text` em `solicitacoes_substituicao_placa` se ainda não existirem.

**Hook** `src/hooks/useSolicitacoesSubstituicao.ts`
- Acrescentar `useCancelarSolicitacaoSubstituicao()` invocando a edge, invalidando `['solicitacao-substituicao', id]` e `['outros-processos']`.

**UI** `src/components/substituicao/ModalDetalhesSubstituicao.tsx`
- Botão `variant="destructive" size="sm"` "Cancelar substituição" no rodapé do modal, dentro de um `AlertDialog` com textarea de motivo.
- Toast de sucesso/erro + fecha modal automaticamente após sucesso.

## Fora de escopo

- Não cancela termos Autentique (sem chamada à API externa).
- Não mexe em SGA/Hinova (substituição ainda não foi efetivada).
- Não toca em contratos/veículos ativos — se a cotação já virou contrato, o botão bloqueia.

## Arquivos

- Criar: `supabase/functions/cancelar-solicitacao-substituicao/index.ts`
- Migration: adicionar `cancelada_em`/`cancelada_por`/`motivo_cancelamento` em `solicitacoes_substituicao_placa`
- Editar: `src/hooks/useSolicitacoesSubstituicao.ts`
- Editar: `src/components/substituicao/ModalDetalhesSubstituicao.tsx`
