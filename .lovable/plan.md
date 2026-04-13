

## Plano: Atualizar `status` da cotação ao assinar contrato

### Problema
Quando o associado assina o contrato, o webhook do Autentique atualiza `status_contratacao` para `contrato_assinado`, mas **não altera o campo `status`**, que permanece como `enviada`. A UI exibe o badge baseado em `status`, então a cotação continua mostrando "ENVIADA" mesmo após assinatura.

Dados reais da cotação COT-20260413-083628282-741:
- `status` = **enviada** (errado — deveria ser `aceita`)
- `status_contratacao` = **contrato_assinado** (correto)

### Solução
Nos 3 pontos que atualizam `status_contratacao` para `contrato_assinado`, incluir também `status: 'aceita'`:

| Arquivo | Linha aprox. | Mudança |
|---------|-------------|---------|
| `supabase/functions/autentique-webhook/index.ts` | ~950 | Adicionar `status: 'aceita'` ao update da cotação |
| `supabase/functions/autentique-webhook/index.ts` | ~1075 | Idem (segundo trecho) |
| `supabase/functions/autentique-sync-contrato/index.ts` | ~460 | Idem |

Cada `.update()` passa de:
```js
{ status_contratacao: "contrato_assinado", contrato_gerado_id: contrato.id }
```
para:
```js
{ status: "aceita", status_contratacao: "contrato_assinado", contrato_gerado_id: contrato.id }
```

Além disso, corrigir a cotação existente com uma migration SQL:
```sql
UPDATE cotacoes SET status = 'aceita' 
WHERE status_contratacao = 'contrato_assinado' AND status = 'enviada';
```

### Escopo
- 2 Edge Functions modificadas + redeploy
- 1 migration SQL (fix retroativo)

