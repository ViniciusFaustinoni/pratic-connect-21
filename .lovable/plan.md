## Problema

Ao cancelar um serviço em **Monitoramento → Serviços de Campo → Serviços**, o backend retorna:

> Could not find the 'motivo_cancelamento' column of 'servicos' in the schema cache

O componente `CancelarServicoDialog.tsx` grava `motivo_cancelamento` em `public.servicos`, mas essa coluna nunca foi criada. Falta apenas a migração — o frontend já está pronto.

## Plano

**1. Migração** em `public.servicos`:
- adicionar `motivo_cancelamento text` (nullable)
- adicionar `cancelado_em timestamptz` (nullable) — preenchido automaticamente quando `status` muda para `'cancelada'`
- adicionar `cancelado_por uuid` (nullable, referência opcional ao usuário que cancelou)
- criar trigger `BEFORE UPDATE` `trg_servicos_set_cancelado_em` que seta `cancelado_em = now()` e `cancelado_por = auth.uid()` quando `status` passa para `'cancelada'` e `cancelado_em IS NULL`

**2. Atualizar `CancelarServicoDialog.tsx`** para incluir `cancelado_em` no update (defensivo, caso o trigger não rode em contexto sem auth.uid()). Sem novos campos no formulário — UX permanece igual.

**3. Verificação**: após a migração, repetir o cancelamento de `LRP3J98` (RET-2026-00005). Resultado esperado: serviço vai para `cancelada`, `motivo_cancelamento` persistido, agendamento_base correspondente encerrado pelo trigger existente (`trg_sync_agendamento_base_on_servico_terminal`).

## Fora de escopo

- Mostrar `motivo_cancelamento` em telas de histórico/auditoria (pode virar próximo passo se quiser).
- Mexer no fluxo de cancelamento de outras entidades (instalações, vistorias).
