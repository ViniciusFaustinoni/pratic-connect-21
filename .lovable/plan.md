

# Permitir vendedor editar cotação (incluir/remover planos) antes da assinatura

## Resumo

A infraestrutura de edição já existe e as permissões já permitem que o vendedor responsável edite sua própria cotação. O problema principal é que **ao abrir o modal de edição, os planos previamente selecionados não são restaurados** — o vendedor vê a lista de planos vazia e perde a seleção anterior. Além disso, o `canEdit` na listagem não bloqueia edição após contrato assinado.

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/cotacoes/CotacaoFormDialog.tsx` | **Editar** — restaurar `planosSelecionados` a partir de `dados_extras.planos_comparacao` |
| `src/pages/vendas/Cotacoes.tsx` | **Editar** — bloquear `canEdit` quando contrato assinado/ativo |

## Detalhes

### 1. CotacaoFormDialog.tsx — Restaurar planos no modo edição (linha ~790-863)

No `useEffect` que preenche o formulário quando `cotacaoParaEditar && open`, adicionar lógica para restaurar `planosSelecionados`:

```
// Após os outros preenchimentos (~linha 837), adicionar:
if (cotacaoParaEditar.dados_extras?.planos_comparacao) {
  const planosRestaurados = cotacaoParaEditar.dados_extras.planos_comparacao;
  // Aguardar que planosDisponiveis estejam carregados para fazer match
  // e restaurar com dados completos (valorMensal, coberturas, etc)
}
```

A restauração precisa cruzar os IDs de `planos_comparacao` com os `planosDisponiveis` (do hook `usePlanosCotacao`) para obter os objetos `PlanoCotacao` completos com `valorMensal`, `coberturas`, etc. Se o plano disponível já estiver carregado, fazer `setPlanosSelecionados` com os matches. Isso garante que ao abrir o editor, os planos apareçam pré-selecionados e o vendedor possa adicionar ou remover planos livremente.

Será necessário um segundo `useEffect` que observe `planosDisponiveis` para fazer o match após carregamento assíncrono.

### 2. Cotacoes.tsx — Bloquear edição após assinatura (linha ~576)

Expandir a lógica de `canEdit` no `getPermissions`:

```ts
canEdit: (permissions.cotacao.canEdit && (!permissions.cotacao.canEditOwnOnly || isOwner))
  && !['assinado', 'ativo'].includes(cotacao.contrato?.status || ''),
```

Isso impede que o botão de edição apareça na listagem quando o contrato já foi assinado, alinhando com o comportamento da página de detalhe.

