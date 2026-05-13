## Objetivo
Ocultar do menu de **Configurações** os 3 itens que já têm caminho próprio na sidebar de **Comissões**:

- Grades de Comissão
- Hierarquia de Comissões
- Comissionamento por Plano

Eles **continuam existindo** (rotas e páginas preservadas) — apenas somem do menu de Configurações.

## Onde está o problema
Arquivo único: `src/pages/configuracoes/ConfiguracoesLayout.tsx`, linhas 23–25:

```ts
{ path: '/configuracoes/grades-comissao', label: 'Grades de Comissão', ... },
{ path: '/configuracoes/atribuicao-comissoes', label: 'Hierarquia de Comissões', ... },
{ path: '/configuracoes/comissionamento-plano', label: 'Comissionamento por Plano', ... },
```

Não há referência destes 3 itens em `ConfiguracoesSidebar.tsx` nem `ConfiguracoesMobileNav.tsx` — todos consomem do mesmo array.

## Mudança
Remover as 3 linhas acima do array de itens do menu de Configurações.

## O que NÃO muda
- Rotas em `App.tsx` permanecem (links diretos / bookmarks continuam abrindo as páginas).
- Páginas `GradesComissao.tsx`, `AtribuicaoComissoes` e `ComissionamentoPlano.tsx` ficam intactas.
- A sidebar de **Comissões** (que já lista Dashboard, Grades, Hierarquia, Relatório, Pagamentos) não é tocada.
- Nenhuma outra função, hook ou regra de comissões é alterada.

## Risco
Praticamente nulo: edição de 3 linhas em 1 arquivo de UI.
