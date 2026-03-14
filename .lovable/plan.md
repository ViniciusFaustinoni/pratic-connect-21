
# Fix: Erro "ambiguous relationship" em `notificar-inicio-rota`

## Problema
A query na linha 59 usa `veiculo:veiculos(...)` sem especificar qual FK usar. A tabela `servicos` tem **duas** FKs para `veiculos`: `servicos_veiculo_id_fkey` e `servicos_novo_veiculo_id_fkey`. O PostgREST retorna erro de ambiguidade, que resulta no 404 "Serviço não encontrado".

## Solução
Especificar a FK explícita na query, linha 59:

```typescript
// De:
veiculo:veiculos(

// Para:
veiculo:veiculos!servicos_veiculo_id_fkey(
```

## Arquivo
- `supabase/functions/notificar-inicio-rota/index.ts` — linha 59, disambiguar FK
- Redeploy da edge function
