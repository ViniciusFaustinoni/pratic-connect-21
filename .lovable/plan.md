

# Permitir vendedor responsavel excluir cotacao antes da assinatura

## Resumo

Atualmente apenas diretores (permissao `canDeleteCotacao`) podem excluir cotacoes. A mudanca permite que o vendedor responsavel pela cotacao tambem possa exclui-la, desde que o contrato ainda nao tenha sido assinado.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/vendas/CotacaoDetalhe.tsx` | **Editar** — expandir logica de `canDelete` |
| `src/pages/vendas/Cotacoes.tsx` | **Editar** — expandir `canDelete` nas permissoes da tabela |
| `src/components/cotacoes/CotacaoAcoes.tsx` | **Editar** — ajustar label/texto quando vendedor (nao diretor) exclui |

## Detalhes

### 1. CotacaoDetalhe.tsx (linha ~477)

Alterar a logica de `canDelete` para:
```
const isVendedorResponsavel = cotacao?.vendedor_id === profile?.id;
const canDelete = isDiretor || (isVendedorResponsavel && !contratoAssinado);
```

Diretor sempre pode excluir. Vendedor responsavel pode excluir somente se `contratoAssinado === false`.

### 2. Cotacoes.tsx (linha ~577)

Na funcao `getPermissions`, expandir `canDelete`:
```
canDelete: permissions.cotacao.canDelete || (isOwner && !contratoAssinadoCheck),
```

Verificar se a cotacao tem contrato com status `assinado` ou `ativo` — se sim, bloquear. Caso contrario, o vendedor dono pode excluir.

### 3. CotacaoAcoes.tsx (linha ~261-263)

Manter o dialog de confirmacao existente. Nenhuma mudanca estrutural necessaria — o botao ja aparece condicionalmente via `canDelete`. Opcionalmente ajustar o texto da descricao para indicar que a exclusao e permitida porque o contrato ainda nao foi assinado.

