

# Fix: Erro "removeChild" ao abrir Nova Cotacao

## Problema
Ao clicar em "Nova Cotacao" (tanto pelo botao direto quanto pelas Acoes Rapidas), a pagina crasha com o erro:
`Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.`

## Causa Raiz
O componente `CotacaoFormDialog.tsx` usa `AnimatePresence` + `motion.div` do framer-motion dentro de um Radix Dialog (portal). Quando o Dialog abre/fecha ou quando os planos expandem/recolhem, o framer-motion manipula o DOM diretamente (animacao de height), criando conflito com o React 18 que tenta remover nos que ja foram movidos pelo portal/animacao.

Este e um bug conhecido da combinacao React 18 + Radix Dialog portals + framer-motion AnimatePresence.

## Solucao

### Arquivo: `src/components/cotacoes/CotacaoFormDialog.tsx`

Substituir os 2 blocos de `AnimatePresence` + `motion.div` por renderizacao condicional simples com transicao CSS:

1. **Linhas ~1600-1630** (lista de coberturas no card de selecao de plano): Trocar `AnimatePresence`/`motion.div` por um `div` com classes CSS de transicao (`transition-all duration-200`) e renderizacao condicional direta.

2. **Linhas ~1789-1818** (lista de coberturas no preview do plano selecionado): Mesma substituicao.

3. **Remover import** de `motion` e `AnimatePresence` de `framer-motion` (linha 2), ja que nao serao mais usados neste componente.

A animacao de expand/collapse sera mantida visualmente usando `overflow-hidden` + `max-h-0`/`max-h-[500px]` com `transition-all duration-200`, sem manipulacao direta do DOM.

## Resultado esperado
- O botao "Nova Cotacao" abre o formulario sem erros
- A funcionalidade de expandir/recolher coberturas continua funcionando com transicao suave
- Sem conflitos de DOM entre React, Radix e framer-motion
