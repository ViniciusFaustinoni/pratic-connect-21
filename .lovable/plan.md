

# Limpeza FASE 4 — Remoção de código morto

## Verificação concluída

Busca global confirmou: **nenhum componente** importa `usePrecoPlano`, `usePrecosPlanos` ou `usePlanosPrecificacao`. Referências encontradas apenas em:
- `src/hooks/usePlanosPrecificacao.ts` (o próprio arquivo)
- `src/integrations/supabase/types.ts` (auto-gerado, atualiza sozinho)
- `supabase/migrations/20260117092638_...sql` (migração histórica, não executa novamente)

A função `fn_calcular_preco_plano` **existe** no banco (confirmado via query).

## Ações

### 1. Migration: dropar função do banco
```sql
DROP FUNCTION IF EXISTS fn_calcular_preco_plano;
```

### 2. Deletar arquivo
- `src/hooks/usePlanosPrecificacao.ts`

### Checklist esperado após execução
- [x] Busca global confirmou: nenhum arquivo importa o hook
- [ ] `fn_calcular_preco_plano` dropada no banco
- [ ] `usePlanosPrecificacao.ts` deletado
- [ ] Projeto compila sem erros

