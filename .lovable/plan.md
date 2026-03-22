

# Plano: Adicionar chave FIPE fallback na Edge Function `plate-lookup`

## Resumo

Adicionar um segundo secret `FIPE_PLACAS_API_KEY_FALLBACK` e implementar lógica de fallback na edge function: se a chave primária falhar (403, 429, 439), tentar automaticamente com a chave secundária antes de retornar erro.

## 1. Novo Secret

Adicionar `FIPE_PLACAS_API_KEY_FALLBACK` com valor `fd0cb86838329646d4f699c02012b3ce`.

## 2. Alteração em `supabase/functions/plate-lookup/index.ts`

Refatorar a lógica de consulta para:

1. Extrair a chamada à API em uma função auxiliar `tentarConsulta(placa, apiKey)` que retorna a Response
2. Tentar com `FIPE_PLACAS_API_KEY` primeiro
3. Se receber status 403, 429 ou 439 (limite/créditos), logar e tentar com `FIPE_PLACAS_API_KEY_FALLBACK`
4. Se a fallback também falhar, retornar o erro normalmente
5. Se `FIPE_PLACAS_API_KEY_FALLBACK` não estiver configurada, comportamento igual ao atual (sem fallback)

```
Chave primária → 403/429/439? → Chave fallback → Erro final
                  ↓ OK                            ↓ OK
              Retorna dados                  Retorna dados
```

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| Secret `FIPE_PLACAS_API_KEY_FALLBACK` | **Novo** |
| `supabase/functions/plate-lookup/index.ts` | Lógica de fallback |

