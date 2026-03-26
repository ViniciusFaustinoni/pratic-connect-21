
# Fix: Erro ao salvar beneficio — CHECK constraint no campo `category`

## Problema

A tabela `benefits` tem um CHECK constraint (`benefits_category_check`) que restringe o campo `category` a: `cobertura`, `assistencia`, `extra`.

O codigo em `CatalogoCoberturasBeneficios.tsx` insere com `category: 'geral'`, que e rejeitado pelo banco (400 Bad Request).

## Solucao

**Migration**: Atualizar o CHECK constraint para incluir `'geral'` como valor valido.

```sql
ALTER TABLE benefits DROP CONSTRAINT benefits_category_check;
ALTER TABLE benefits ADD CONSTRAINT benefits_category_check 
  CHECK (category IN ('cobertura', 'assistencia', 'extra', 'geral'));
```

Nenhuma alteracao de frontend necessaria.
