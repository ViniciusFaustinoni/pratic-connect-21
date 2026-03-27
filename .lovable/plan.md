

# Remover Toggle de Migração de Dentro da Cotação

## Problema
O toggle "É migração de outra associação?" aparece dentro do formulário de cotação, mas essa opção já deve estar definida antes de abrir o modal da cotação.

## Alterações

### 1. `src/components/cotacoes/CotacaoFormDialog.tsx`
- Remover a linha `<MigracaoToggle value={migracaoState} onChange={setMigracaoState} />` (~linha 2102-2103)
- Manter o estado `migracaoState` e a lógica de carência que o usa (linhas 2087-2098), pois o estado pode ser passado via props futuramente
- Remover import do `MigracaoToggle` se não for mais usado

### 2. `src/pages/vendas/Cotador.tsx`
- Remover a linha `<MigracaoToggle value={migracaoState} onChange={setMigracaoState} />` (~linha 1935)
- Manter o estado e a lógica de carência

Ambos os arquivos mantêm o `migracaoState` e a lógica condicional de carência — apenas o toggle visual é removido do formulário.

| Arquivo | Ação |
|---|---|
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Remover toggle de migração do formulário |
| `src/pages/vendas/Cotador.tsx` | Remover toggle de migração do formulário |

