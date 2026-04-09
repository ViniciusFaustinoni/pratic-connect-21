

## Plano: Corrigir carregamento de regras de elegibilidade na lista de planos

### Problema
A query que busca regras de elegibilidade usa `.in('entity_id', allEntityIds)` com ~574 IDs. O Supabase tem limite de tamanho de URL para queries GET, causando falha silenciosa ou resultados parciais. Por isso muitos badges de regras nao aparecem.

### Solucao
Dividir a query `.in()` em lotes de 100 IDs e concatenar os resultados.

### Alteracao

**`src/components/gestao-comercial/LinhasPlanos.tsx` (linhas 171-196)**
- Substituir a query unica por um loop que divide `allEntityIds` em chunks de 100
- Para cada chunk, fazer `.in('entity_id', chunk)` separadamente
- Concatenar todos os resultados antes de montar o `rulesMap`

```ts
// Antes (falha com muitos IDs):
const { data: rules } = await supabase
  .from('entity_eligibility_rules')
  .select('*')
  .in('entity_id', allEntityIds)
  .eq('is_active', true);

// Depois (lotes de 100):
const CHUNK = 100;
const allRules: EligibilityRule[] = [];
for (let i = 0; i < allEntityIds.length; i += CHUNK) {
  const chunk = allEntityIds.slice(i, i + CHUNK);
  const { data } = await supabase
    .from('entity_eligibility_rules')
    .select('*')
    .in('entity_id', chunk)
    .eq('is_active', true);
  if (data) allRules.push(...(data as EligibilityRule[]));
}
```

### Resultado
- Todas as regras sao carregadas independentemente da quantidade de entidades
- Badges de tipo_uso, regiao, combustivel e tipo_placa aparecem corretamente em todas as coberturas e beneficios

### Arquivo
- `src/components/gestao-comercial/LinhasPlanos.tsx`

