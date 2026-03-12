

# Correção: Sync Autentique não detecta assinatura

## Causa raiz

A query GraphQL na `autentique-sync-contrato` (linhas 302-305) solicita os campos `sha256` e `sha512` no tipo `Hash`, mas a API Autentique usa `sha2` e `sha1`. Isso causa erro GraphQL que **aborta toda a consulta**, impedindo qualquer detecção de assinatura.

Os logs confirmam:
```
Cannot query field "sha256" on type "Hash". Did you mean "sha2" or "sha1"?
Cannot query field "sha512" on type "Hash". Did you mean "sha1" or "sha2"?
```

## Correção

### `supabase/functions/autentique-sync-contrato/index.ts`

Remover o bloco `hashes` da query GraphQL (linhas 301-304). Os hashes não são usados na lógica de detecção de assinatura -- o fallback já compara tamanhos de PDF.

**Antes:**
```graphql
hashes {
  sha256
  sha512
}
```

**Depois:** Bloco removido inteiramente.

Também remover a referência a `document.hashes?.sha256` na linha 392, que nunca era utilizada de fato.

### Deploy
Redeploy da edge function `autentique-sync-contrato`.

## Resultado
A query GraphQL passa a funcionar, o status de assinatura é detectado corretamente, e o link público atualiza automaticamente.

