

## Plano: Corrigir polling do link de assinatura — GRANT SELECT ausente

### Causa raiz

A tabela `contratos` **não tem `GRANT SELECT ... TO anon`**. Existe a RLS policy `anon_select_contratos_by_cotacao_token` que permite leitura quando `cotacao_token_publico IS NOT NULL`, mas sem o GRANT no nível da tabela, o PostgREST ignora completamente a query do `publicSupabase` (role anon). Resultado: **todo polling que tenta ler `autentique_url` da tabela `contratos` retorna `null`**, mesmo quando o link já existe no banco.

Isso explica por que:
- O edge function (service role) salva o link corretamente
- O componente nunca consegue lê-lo de volta
- A página fica presa em "Aguarde... estamos gerando seu link de assinatura"

### Alterações

**1. Nova migration SQL**
```sql
GRANT SELECT ON public.contratos TO anon;
```
Apenas isso. A RLS policy existente (`anon_select_contratos_by_cotacao_token`) já restringe corretamente o acesso apenas a contratos com `cotacao_token_publico IS NOT NULL`.

**2. `EtapaAssinaturaContrato.tsx` — adicionar log de debug no polling**
Adicionar `console.log` do resultado da query no polling step 4 para facilitar diagnóstico futuro caso o problema persista:
```typescript
console.log('[EtapaAssinatura] Polling DB result:', data);
```

### Resultado
O polling de 3s passará a ler `autentique_url` do banco com sucesso, e o botão "Assinar Contrato Agora" aparecerá automaticamente assim que o link for salvo pelo edge function.

