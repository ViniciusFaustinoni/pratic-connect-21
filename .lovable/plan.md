

# Fix: Ressalvas pendentes not appearing in list

## Root Cause

The `useRessalvasPendentesMonitoramento` hook query uses `veiculos!inner(...)` without specifying which FK to use. The `servicos` table has TWO foreign keys to `veiculos`:
- `servicos_veiculo_id_fkey` (the one we want)
- `servicos_novo_veiculo_id_fkey`

PostgREST cannot resolve the ambiguity and returns a **300 error**, causing the list to show empty. The **count** query (no joins) works, which explains why the badge shows "1 pendente" but the list shows "Nenhuma ressalva pendente."

Similarly, there are bidirectional FKs between `servicos` and `associados` that could also cause ambiguity.

## Fix

In `src/hooks/useRessalvasMonitoramento.ts`, change the join hints to explicitly specify the FK:

```
associados!inner(nome, cpf, telefone)
→ associados!servicos_associado_id_fkey(nome, cpf, telefone)

veiculos!inner(placa, modelo, marca)
→ veiculos!servicos_veiculo_id_fkey(placa, modelo, marca)
```

Keep `!inner` behavior by still filtering out nulls, but remove the `!inner` syntax and rely on the explicit FK hint.

## Files

| File | Change |
|---|---|
| `src/hooks/useRessalvasMonitoramento.ts` | Fix ambiguous FK joins on lines 39-40 |

1 file changed.

