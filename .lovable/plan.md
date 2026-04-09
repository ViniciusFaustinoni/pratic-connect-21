

## Plano: Mostrar todas as coberturas no dialog "Atribuir Existente" e permitir reatribuição

### Problema
O dialog mostra apenas 18 coberturas não vinculadas. As outras 378 já atribuídas a outros planos ficam ocultas. O usuário quer ver todas e poder reatribuir.

### Alteração

**`src/components/admin/planos/PlanCoberturasList.tsx`**

1. **Query**: Buscar TODAS as coberturas ativas, junto com o plano ao qual estão vinculadas (se houver):
```ts
queryFn: async () => {
  // Buscar todas as coberturas ativas
  const { data: allCoberturas } = await supabase
    .from('coberturas').select('*').eq('ativo', true).order('nome');
  
  // Buscar vínculos existentes com nome do plano
  const { data: vinculos } = await supabase
    .from('planos_coberturas')
    .select('cobertura_id, plano_id, planos(nome)');
  
  // Mapear cobertura_id → plano info
  const vinculoMap = new Map(vinculos.map(v => [v.cobertura_id, v]));
  
  return allCoberturas.map(c => ({
    ...c,
    vinculadaAo: vinculoMap.get(c.id) || null
  }));
}
```

2. **UI da lista**: Mostrar todas, com indicação visual de plano atual:
   - Coberturas livres: checkbox normal
   - Coberturas já vinculadas ao plano atual: ocultas (já estão na lista do plano)
   - Coberturas vinculadas a outro plano: checkbox habilitado + badge cinza com nome do plano de origem

3. **Ao vincular**: Para coberturas que já estavam em outro plano, primeiro deletar o vínculo anterior em `planos_coberturas`, depois inserir o novo. Exibir toast informando a reatribuição.

4. **Paginação**: Como há 396 coberturas, usar busca textual e renderizar com scroll virtual ou limitar exibição com campo de busca (já existe).

### Resultado
- Todas as 396 coberturas aparecem no dialog
- Coberturas vinculadas a outros planos mostram badge com nome do plano
- Ao selecionar e confirmar, o vínculo anterior é removido e o novo é criado
- Queries relacionadas são invalidadas para atualizar ambos os planos

### Arquivo
- `src/components/admin/planos/PlanCoberturasList.tsx`

