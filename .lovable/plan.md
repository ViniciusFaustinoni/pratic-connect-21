

## Plano: Corrigir query de coberturas no modal de edicao do plano

### Problema
A query em `PlanCoberturasList` faz `.order('display_order', { ascending: true })` na tabela `planos_coberturas`, mas essa tabela nao possui coluna `display_order`. A coluna existe apenas na tabela `coberturas`. Isso causa erro no PostgREST e retorna array vazio, fazendo com que nenhuma cobertura seja exibida no modal.

### Alteracao

**`src/components/admin/planos/PlanCoberturasList.tsx`** (linha ~177)
- Remover o `.order('display_order', { ascending: true })` da query principal
- Ordenar no client-side usando `coberturas.display_order` apos o mapeamento, ou usar `.order('coberturas(display_order)')` se suportado pelo PostgREST
- Alternativa mais simples: remover o order e ordenar em JS: `(data || []).map(...).filter(Boolean).sort((a,b) => (a.display_order ?? 0) - (b.display_order ?? 0))`

### Resultado
- Coberturas voltam a aparecer corretamente no modal de edicao do plano

### Arquivo
- `src/components/admin/planos/PlanCoberturasList.tsx`

