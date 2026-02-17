
# Adicionar Titulos nos Filtros e Filtro de Parecer do Regulador

## Problema

Na tela de listagem de sinistros do Analista de Eventos, os filtros (busca, tipo, status) nao possuem titulos/labels. Alem disso, falta um filtro por "Parecer do Regulador" que permita filtrar entre sinistros cuja recomendacao na vistoria foi "Aprovar" ou "Analise Detalhada".

## Solucao

1. Adicionar labels acima de cada filtro existente (Busca, Tipo, Status)
2. Adicionar um novo filtro "Parecer do Regulador" com opcoes: Todos, Aprovar, Analise Detalhada
3. O parecer esta armazenado no campo `dados_vistoria->>'recomendacao'` da tabela `vistorias_evento`, com valores `aprovar` ou `analise_detalhada`

## Alteracoes

### Arquivo: `src/pages/eventos/SinistrosList.tsx`

1. **Expandir a interface `Filters`** para incluir `parecer: string`:
   ```typescript
   interface Filters {
     busca: string;
     status: string;
     tipo: string;
     parecer: string; // 'todos' | 'aprovar' | 'analise_detalhada'
   }
   ```

2. **Adicionar `parecer: 'todos'`** ao estado inicial dos filtros

3. **Adicionar labels nos filtros existentes**: Envolver cada filtro em um `<div>` com um `<Label>` acima (Protocolo, Tipo, Status)

4. **Adicionar novo Select de "Parecer do Regulador"** com label e opcoes:
   - Todos os pareceres
   - Aprovar
   - Analise Detalhada

5. **Alterar a query principal**: Quando `filters.parecer !== 'todos'`, fazer um join/subquery com `vistorias_evento` para filtrar pelo campo `dados_vistoria->>'recomendacao'`:
   - Buscar IDs de sinistros que possuem vistoria concluida com a recomendacao selecionada
   - Filtrar a query principal usando `.in('id', sinistroIds)`

### Detalhes tecnicos

**Filtro por parecer na query:**

Como o parecer esta em `dados_vistoria` (JSONB) da tabela `vistorias_evento`, sera necessario fazer uma query previa quando o filtro estiver ativo:

```typescript
if (filters.parecer && filters.parecer !== 'todos') {
  // Buscar sinistro_ids com a recomendacao filtrada
  const { data: vistoriasComParecer } = await supabase
    .from('vistorias_evento')
    .select('sinistro_id')
    .eq('status', 'concluida')
    .filter('dados_vistoria->>recomendacao', 'eq', filters.parecer);

  const ids = (vistoriasComParecer || []).map((v: any) => v.sinistro_id);
  if (ids.length > 0) {
    query = query.in('id', ids);
  } else {
    // Nenhum resultado - forcar lista vazia
    query = query.eq('id', '00000000-0000-0000-0000-000000000000');
  }
}
```

**Layout dos filtros com labels:**

```tsx
<div className="flex flex-wrap gap-4">
  <div className="flex-1 min-w-[200px] space-y-1.5">
    <Label className="text-xs text-muted-foreground">Protocolo</Label>
    <div className="relative">
      <Search ... />
      <Input ... />
    </div>
  </div>

  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">Tipo</Label>
    <Select ... />
  </div>

  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">Status</Label>
    <Select ... />
  </div>

  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">Parecer do Regulador</Label>
    <Select value={filters.parecer} onValueChange={...}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Parecer" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos os pareceres</SelectItem>
        <SelectItem value="aprovar">Aprovar</SelectItem>
        <SelectItem value="analise_detalhada">Analise Detalhada</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>
```

Essas alteracoes afetam apenas o arquivo `SinistrosList.tsx`. O filtro de parecer e importado da `Label` (ja existente no projeto) e usa o Select padrao ja presente no componente.
