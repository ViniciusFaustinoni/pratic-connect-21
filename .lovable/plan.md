# Adicionar botão "Cancelar" em Liberação de Suspensão

Adiciona ao lado do "Liberar" existente um botão **Cancelar** (por item + em lote) que encerra a adesão de associados que não instalaram o rastreador no prazo.

## Backend — nova edge function `cancelar-adesao-nao-instalada`

Recebe `{ contrato_ids: string[], motivo: string }` (motivo obrigatório, mín. 10 caracteres). Espelha o padrão de `liberar-reagendamento-autovistoria` (auth + profile + auditoria). Para cada contrato:

1. **`contratos`** → `status='cancelado'`, `data_cancelamento=now()`.
2. **`cotacoes`** vinculadas → `status='cancelada'` (apenas as não terminais).
3. **`veiculos`** → mantém `cobertura_suspensa=true` com motivo "Adesão cancelada — não instalou no prazo"; zera `cobertura_roubo_furto` e `cobertura_total`.
4. **Serviços/agendamentos/instalações abertos** vinculados → `status='cancelada'` com motivo "Adesão cancelada pelo Monitoramento" (sumirem das filas de Serviços de Campo).
5. **`associados`** → vira `cancelado` apenas se não houver outro contrato vivo (`ativo/assinado/pendente_assinatura/visualizado`).
6. **WhatsApp** ao associado avisando do cancelamento + motivo.
7. **`logs_auditoria`** com ação `cancelamento_nao_instalacao`, contrato_ids e motivo.

Sem geração de termo Autentique, sem chamadas SGA, sem estorno financeiro — fora do escopo desta fila.

## Frontend

**`src/hooks/useLiberacoesAutoVistoria.ts`** — adicionar `useCancelarAdesaoNaoInstalada()` espelhando `useLiberarAutoVistoria()`, invocando a nova edge function e invalidando `['liberacoes-autovistoria']` + `['aprovacoes-monitoramento-breakdown']`.

**`src/pages/monitoramento/LiberacoesAutoVistoria.tsx`**:
- Botão **"Cancelar selecionados (N)"** no header (variant `destructive outline`), ao lado de "Liberar selecionados".
- Botão **"Cancelar"** em cada linha, ao lado do "Liberar" atual.
- Novo `<Dialog>` separado para cancelamento, com:
  - Título "Cancelar N adesão(ões)" e aviso de irreversibilidade.
  - `Textarea` **Motivo (obrigatório)**, mín. 10 caracteres.
  - Botão "Confirmar cancelamento" (variant `destructive`), desabilitado até motivo válido.

## Sem migração de schema

O schema atual já tem `contratos.status='cancelado'` e `contratos.data_cancelamento`. Motivo fica registrado em `logs_auditoria.dados_novos` (não há coluna `motivo_cancelamento` em `contratos` e criar uma agora foge do escopo).

## Arquivos

- `supabase/functions/cancelar-adesao-nao-instalada/index.ts` (novo)
- `src/hooks/useLiberacoesAutoVistoria.ts` (adicionar hook)
- `src/pages/monitoramento/LiberacoesAutoVistoria.tsx` (adicionar botões + dialog)

## Fora de escopo

Termo de cancelamento Autentique, regras de débito/estorno, sincronização SGA do cancelamento, cancelamento em massa fora desta fila.
