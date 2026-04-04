

# Corrigir Link de Assinatura Autentique (DNS_PROBE_FINISHED_NXDOMAIN)

## Problema
O fallback `https://assinar.autentique.com.br/{public_id}` está errado — esse domínio não existe. Quando a API do Autentique não retorna `short_link` na criação ou no retry, o sistema grava essa URL inválida no banco.

A solução correta é usar a mutation `createLinkToSignature(public_id)` da API do Autentique para gerar o `short_link` real.

## Solução

### `supabase/functions/autentique-create/index.ts`

**1. Substituir fallback de URL construída por chamada à mutation `createLinkToSignature`**

Em dois locais do arquivo:

**Linha ~194 (busca de documento existente):** Substituir:
```typescript
if (!signatureLink && sig?.public_id) {
  signatureLink = `https://assinar.autentique.com.br/${sig.public_id}`;
}
```
Por:
```typescript
if (!signatureLink && sig?.public_id) {
  const createLinkMutation = `mutation { createLinkToSignature(public_id: "${sig.public_id}") { short_link } }`;
  const linkResp = await fetch(AUTENTIQUE_API_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${autentiqueApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: createLinkMutation }),
  });
  const linkResult = await linkResp.json();
  signatureLink = linkResult?.data?.createLinkToSignature?.short_link || null;
}
```

**Linha ~737 (retry após criação):** Adicionar a mesma mutation como segundo fallback se o retry de query também não retornar `short_link`:
```typescript
if (!signatureLink) {
  // Tentar gerar link via mutation createLinkToSignature
  const publicId = retryData?.data?.document?.signatures?.[0]?.public_id;
  if (publicId) {
    const createLinkMutation = `mutation { createLinkToSignature(public_id: "${publicId}") { short_link } }`;
    // ... fetch e extrair short_link
  }
}
```

Também atualizar o retry query para incluir `public_id` no select: `signatures { public_id link { short_link } }`.

### Correção de dados existentes
Executar query SQL para identificar contratos com `autentique_url` contendo o domínio errado e limpar para que o polling do frontend re-busque via a edge function corrigida.

## Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `supabase/functions/autentique-create/index.ts` | Substituir fallback por `createLinkToSignature` mutation |

