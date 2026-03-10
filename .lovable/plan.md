

# Fix: Check constraint on `associados_historico.tipo` missing ressalva types

## Problem

The `associados_historico` table has a CHECK constraint (`associados_historico_tipo_check`) that restricts the `tipo` column to a fixed list of values. The following types used in the codebase are **not** in that list:

- `ressalva_registrada` (used in `AdicionarRessalva.tsx` and `RessalvasPendentes.tsx`)
- `ressalva_aprovada_monitoramento` (used in `useRessalvasMonitoramento.ts`)
- `ressalva_declinada_monitoramento` (used in `useRessalvasMonitoramento.ts`)

This causes the error: `new row violates check constraint "associados_historico_tipo_check"`.

## Fix

Run a SQL migration to drop and recreate the constraint with the missing types added:

```sql
ALTER TABLE public.associados_historico
  DROP CONSTRAINT associados_historico_tipo_check;

ALTER TABLE public.associados_historico
  ADD CONSTRAINT associados_historico_tipo_check
  CHECK (tipo::text = ANY (ARRAY[
    'associado_criado', 'status_alterado', 'dados_atualizados',
    'documento_enviado', 'documento_aprovado', 'documento_reprovado',
    'veiculo_adicionado', 'veiculo_removido',
    'instalacao_agendada', 'instalacao_concluida', 'instalacao_cancelada',
    'boleto_gerado', 'boleto_pago', 'boleto_cancelado',
    'chamado_aberto', 'chamado_concluido',
    'sinistro_aberto', 'sinistro_atualizado', 'sinistro_encerrado',
    'contrato_assinado', 'observacao_adicionada',
    'ressalva_registrada', 'ressalva_aprovada_monitoramento', 'ressalva_declinada_monitoramento'
  ]::text[]));
```

| What | Detail |
|---|---|
| File | SQL migration (no frontend changes needed) |
| Change | Add 3 missing `tipo` values to the CHECK constraint |

No frontend code changes required — the code is correct, the database constraint is just missing the newer types.

