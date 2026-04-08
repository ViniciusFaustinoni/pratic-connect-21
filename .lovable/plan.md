

# Plano: Submenus colapsaveis na navegacao lateral

## Alteracao

Arquivo: `src/components/gestao-comercial/TabNavigation.tsx`

Tornar cada grupo (Produtos, Financeiro, Operacao, Cadastros) colapsavel com clique no cabecalho:

1. Adicionar estado `expandedGroups` como `Set<string>` — inicializado com o grupo que contem o item ativo
2. O cabecalho de cada grupo vira um botao clicavel com icone chevron (ChevronDown/ChevronRight) que alterna a expansao
3. O grupo que contem o item ativo fica sempre expandido automaticamente (ao trocar de tab, o grupo correspondente abre)
4. Os itens filhos ficam dentro de um bloco com animacao de altura (Collapsible do Radix, ja disponivel no projeto)
5. Manter a mesma aparencia visual, apenas adicionando o comportamento de colapso

### Comportamento
- Ao clicar no cabecalho do grupo: toggle expand/collapse
- Ao selecionar um item: o grupo pai abre automaticamente
- Multiplos grupos podem ficar abertos simultaneamente
- O badge de contagem e o chevron ficam no cabecalho

### Componentes utilizados
- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` de `@/components/ui/collapsible` (ja existe)

## Arquivo modificado
- `src/components/gestao-comercial/TabNavigation.tsx`

