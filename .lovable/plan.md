
# Fix: Edge Function `agendar-vistoria-presencial` — 2 bugs

## Bugs identificados nos logs

**Bug 1 — Enum inválido (`22P02`)**
Linha 64: o filtro `.not('status', 'in', '("cancelada","recusada")')` falha porque `"recusada"` não existe no enum `status_servico`. Valores válidos: `pendente, agendada, em_rota, em_andamento, concluida, aprovada, reprovada, aprovada_ressalvas, em_analise, reagendada, cancelada, nao_compareceu`.

**Bug 2 — Múltiplos contratos (`PGRST116`)**
Linha 126: `.single()` na query de contratos falha quando a cotação tem 2+ contratos vinculados ("The result contains 2 rows").

## Correções em `supabase/functions/agendar-vistoria-presencial/index.ts`

### Fix 1 — Linha 64
Remover `"recusada"` do filtro:
```typescript
// DE:
.not('status', 'in', '("cancelada","recusada")');
// PARA:
.not('status', 'in', '("cancelada")');
```

### Fix 2 — Linhas 122-126
Trocar `.single()` por `.order().limit(1).maybeSingle()`:
```typescript
// DE:
.eq('cotacao_id', cotacaoId)
.single();
// PARA:
.eq('cotacao_id', cotacaoId)
.order('created_at', { ascending: false })
.limit(1)
.maybeSingle();
```

## Arquivo modificado
- `supabase/functions/agendar-vistoria-presencial/index.ts` (2 correções pontuais)
