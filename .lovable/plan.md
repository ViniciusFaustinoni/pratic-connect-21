

## Plano: Corrigir limite de 1000 linhas nas queries de coberturas/benefícios

### Problema

A query da UI (`useLinhasComPlanos`) busca `planos_coberturas` e `planos_beneficios` para **todos os 303 planos de uma vez**, mas o Supabase retorna no máximo **1000 linhas por padrão**. Existem **2385 coberturas** e **1458 benefícios** — a maioria é truncada silenciosamente. Planos que ficam fora das primeiras 1000 linhas aparecem com "0 cob. 0 ben."

A lógica de duplicação (`useDuplicateProductLine`) também não verifica erros em vários `insert()` batch, podendo falhar silenciosamente.

### Correção

**Arquivo: `src/components/gestao-comercial/LinhasPlanos.tsx`** — `useLinhasComPlanos`

Paginar as queries de `planos_coberturas` e `planos_beneficios` em chunks de IDs (como já é feito para `entity_eligibility_rules`):

```typescript
// Coberturas: fetch in chunks to avoid 1000-row limit
const CHUNK = 80;
for (let i = 0; i < planoIds.length; i += CHUNK) {
  const chunk = planoIds.slice(i, i + CHUNK);
  const { data } = await supabase
    .from('planos_coberturas')
    .select('plano_id, cobertura_id, coberturas(id, nome, valor)')
    .in('plano_id', chunk);
  // process...
}
// Same pattern for planos_beneficios
```

**Arquivo: `src/hooks/usePlansAdmin.ts`** — `useDuplicateProductLine`

Adicionar verificação de erro nos `Promise.all` das linhas 1310-1314 e 1383-1386:

```typescript
const [pbRes, brRes, exRes] = await Promise.all([...]);
if (pbRes?.error) throw pbRes.error;
if (brRes?.error) throw brRes.error;
// etc.
```

### Resumo das mudanças
| Arquivo | Mudança |
|---------|---------|
| `LinhasPlanos.tsx` | Paginar queries de coberturas e benefícios em chunks |
| `usePlansAdmin.ts` | Adicionar tratamento de erro nos batch inserts da duplicação |

