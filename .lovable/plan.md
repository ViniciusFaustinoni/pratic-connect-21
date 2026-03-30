

# Corrigir overflow de texto nos cards de plano na cotação

## Problema
O texto das coberturas (ex: "Rastreador/Monitoramento (não cobre)") ultrapassa os limites do card, quebrando o layout visual.

## Causa
Os spans de texto dentro das coberturas não têm controle de overflow — textos longos, especialmente com o label "(não disponível)", estouram o card.

## Solução

### `src/components/cotacao/PlanoCardCotacao.tsx`

1. **Coberturas removidas (linhas 123-133)**: O layout usa `flex` com `ml-auto` no "(não disponível)", forçando o texto a não quebrar. Corrigir:
   - Adicionar `min-w-0` no container flex e `truncate` ou `break-words` nos spans de texto
   - Remover o span separado "(não disponível)" e integrar o texto inline ou usar `whitespace-normal` com `overflow-hidden`

2. **Coberturas normais (linhas 134-138)**: Adicionar `min-w-0` no flex container e `truncate` ou `break-words` no span de texto

3. **Card raiz**: Adicionar `overflow-hidden` no Card para garantir que nada vaze

| Arquivo | Ação |
|---|---|
| `src/components/cotacao/PlanoCardCotacao.tsx` | Adicionar overflow-hidden no Card + min-w-0/truncate nos textos de coberturas |

