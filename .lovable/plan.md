

## Plano: Filtrar planos incorretos nos badges de Benefícios e Coberturas

### Problema
A query de associações benefício-plano em `BeneficiosCoberturas.tsx` busca TODOS os planos da tabela `planos_beneficios` sem filtrar por `visivel_gestao=true`. Resultado: badges com planos que não existem mais na interface unificada (ex: "SELECT EXCLUSIVE APLICATIVO", "SELECT ONE APLICATIVO", "LANÇAMENTO EXCLUSIVE APLICATIVO").

### Correção

**Arquivo: `src/components/gestao-comercial/BeneficiosCoberturas.tsx`**

1. **Query de associações (linhas 49-51)**: Adicionar filtro `visivel_gestao=true` na join com planos:
   ```
   .from('planos_beneficios')
   .select('benefit_id, plano_id, planos!inner(nome, visivel_gestao)')
   .eq('planos.visivel_gestao', true)
   ```
   Isso garante que apenas planos reais (visíveis na gestão) apareçam como badges.

2. **Texto de referência (linha 115)**: Trocar `"Produtos & Planos"` por `"Planos, Produtos e Preços"` para refletir o novo nome da aba unificada.

3. **Dropdown de filtro (linhas 93-95)**: O `usePlans()` já filtra `visivel_gestao=true` — sem mudança necessária.

### Arquivo afetado
- `src/components/gestao-comercial/BeneficiosCoberturas.tsx` — 2 alterações pontuais

