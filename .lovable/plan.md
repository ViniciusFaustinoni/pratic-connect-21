

## Plano: Remover exibicao "nao cobre" e simplesmente ocultar coberturas/beneficios inelegiveis

### Situacao atual

O motor de cotacao (`usePlanosCotacao.ts`) ja faz a filtragem corretamente:
- Linha rejeita veiculo → plano nao aparece (OK)
- Cobertura/beneficio inelegivel → removido do calculo de preco, mas o nome e guardado em `coberturasRemovidas` e exibido com risco + "(nao cobre)"

### O que mudar

Remover a exibicao visual de "nao cobre" em todos os lugares. Coberturas/beneficios inelegiveis devem simplesmente nao aparecer na lista.

### Arquivos alterados

1. **`src/components/cotacoes/CotacaoFormDialog.tsx`** (linhas ~1975-2015, ~2356-2380)
   - Filtrar `plano.coberturas` para excluir itens que estao em `plano.coberturasRemovidas` antes de renderizar
   - Remover toda a logica `isRemovida` / strikethrough / "(nao cobre)"

2. **`src/pages/vendas/Cotador.tsx`** (linha ~1791-1793)
   - Mesmo tratamento: filtrar coberturas removidas em vez de mostrar com risco

3. **`src/components/cotacoes/PlanoCardComparativo.tsx`**
   - Remover exibicao de itens removidos

4. **`src/lib/gerarPdfCotacao.ts`** (linhas ~630-637, ~1580-1586, ~1782)
   - Remover secao "NAO APLICAVEL PARA ESTE VEICULO" do PDF
   - Na tabela comparativa, nao listar coberturas removidas

### O que NAO muda
- `usePlanosCotacao.ts` -- o motor continua filtrando corretamente e mantendo `coberturasRemovidas` internamente (util para logs/debug)
- Logica de descarte de plano quando todas as coberturas sao removidas
- Filtragem de linha

