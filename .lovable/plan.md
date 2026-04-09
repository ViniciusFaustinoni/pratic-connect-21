

## Plano: Remover coluna "Ordem" da lista de planos

### Alteração

**`src/components/gestao-comercial/LinhasPlanos.tsx`** (linha ~389)
- Remover o `<span>Ordem {plano.ordem ?? 0}</span>` da linha do plano
- Manter a query com `ordem` e `.order('ordem')` para garantir a ordenação correta dos planos — apenas a exibição visual será removida

### Resultado
- A coluna "Ordem X" não aparece mais na listagem de planos
- A ordenação interna continua funcionando normalmente

### Arquivo
- `src/components/gestao-comercial/LinhasPlanos.tsx`

