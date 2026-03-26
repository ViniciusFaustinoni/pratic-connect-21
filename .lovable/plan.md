

# Fix: Nomes parecidos em coberturas

## Diagnostico

O fix anterior (slug + 4 chars UUID) ja esta aplicado e deveria funcionar. Porem:

1. **Coberturas antigas** foram criadas com slugs truncados/malformados (ex: `colis-o`, `alagamento-por-gua-d`) — sem sufixo UUID
2. O sufixo de 4 caracteres (65.536 combinacoes) e seguro mas curto

## Solucao

### 1. Aumentar sufixo UUID de 4 para 8 caracteres

No `CatalogoCoberturasBeneficios.tsx`, alterar ambos CoberturaSheet e BeneficioSheet:

```ts
// De:
crypto.randomUUID().slice(0, 4)
// Para:
crypto.randomUUID().slice(0, 8)
```

### 2. Corrigir slugs antigos via migration

Migration para regenerar codigos/slugs de coberturas que nao possuem sufixo UUID (coberturas criadas antes do fix):

```sql
UPDATE coberturas 
SET codigo = codigo || '-' || substr(gen_random_uuid()::text, 1, 8)
WHERE codigo NOT LIKE '%-%-%-%';
```

Isso garante que coberturas antigas tambem tenham slugs unicos e nao colidam com novas criacoes.

## Arquivos

| Arquivo | Acao |
|---|---|
| `CatalogoCoberturasBeneficios.tsx` | Aumentar UUID suffix de 4 para 8 chars |
| Migration SQL | Corrigir slugs antigos sem sufixo UUID |

