

# Correção do PDF de Cotação Comparativa — 6 Problemas

## Arquivo alvo
`src/lib/gerarPdfCotacao.ts`

## Problema 1 — Textos truncados na capa
**Causa**: `truncateText(cobertura, maxChars)` na linha 1033 do `desenharCardPlanoExpandido` corta textos longos com "…".
**Correção**: Usar `doc.splitTextToSize()` em vez de `truncateText` para as coberturas nos cards da capa. Se o texto precisar de 2 linhas, avançar `currentY` proporcionalmente. Ajustar `maxChars` para usar a largura real do card.

## Problema 2 — Cards com alturas desiguais / INVESTIMENTO desalinhado
**Causa**: Embora `fixedHeight` já equalize a altura dos cards, o `1º Pagamento` ainda soma adesão + mensalidade (linha 1075: `const primPag = plano.valorAdesao + plano.valorMensal`), o que é o bug de valor já corrigido nas páginas de detalhe mas não na capa.
**Correção**: 
- Linha 1075: mudar para `const primPag = plano.valorAdesao` (só adesão).
- A seção INVESTIMENTO já está ancorada ao fundo do card (linha 1048), o que está correto. Mas o texto ficará mais coerente.

## Problema 3 — "Taxa de Filiação" vs "Taxa de Adesão"
**Causa**: Na capa (linha 1069), o label é "Taxa de Filiação:". Nas páginas de detalhe (linha 1611) já está "Taxa de Adesão".
**Correção**: Linha 1069 — mudar de `'Taxa de Filiação:'` para `'Taxa de Adesão:'`. Também no PDF simples, linha 583 ("TAXA DE FILIAÇÃO") e linha 747 ("TAXA DE FILIAÇÃO") devem mudar para "TAXA DE ADESÃO".

## Problema 4 — Espaço vazio no card de preço (páginas 2-4)
**Causa**: O `valorCardHeight` (linha 1356) usa `Math.max(dynamicCardContentH, priceBlockH + 10)` com `priceBlockH = 30`, resultando em no mínimo 40mm mesmo quando o conteúdo é menor. Além disso, o preço está posicionado no centro vertical do card (linha 1421: `y + valorCardHeight / 2 - 4`), deixando espaço em branco.
**Correção**: Posicionar o preço ao lado do conteúdo (alinhado ao `cardY` da última badge/cota), não ao centro vertical. Reduzir `priceBlockH` para 20 e ajustar o padding. O card ficará mais compacto.

## Problema 5 — Espaço em branco excessivo na página 5 (comparativo)
**Causa**: O rodapé está fixo em `pageHeight - 20` (linha 1784), deixando um vazio enorme entre a tabela e o rodapé.
**Correção**: Após renderizar a tabela, calcular o `y` final. Posicionar o rodapé em `Math.max(y + 20, pageHeight - 20)` — ou seja, o rodapé fica logo abaixo da tabela se ela for curta, ou no fundo da página se a tabela for longa.

## Problema 6 — Card SELECT EXCLUSIVE com destaque vermelho sem explicação
**Causa**: O primeiro card (index 0) recebe `isRecommended = true` automaticamente (linha 1252: `const planoRecomendadoIndex = numPlanos > 1 ? 0 : -1`), mas não há label visual.
**Correção**: Dentro de `desenharCardPlanoExpandido`, quando `isRecommended` é true, desenhar uma badge "MAIS COMPLETO" acima do card (como uma tag flutuante com fundo dourado/amarelo, posicionada no topo do card). Usar o campo `plano.destaque` se existir, senão usar "MAIS COMPLETO" como padrão.

## Correção adicional no PDF simples
Linhas 575-586: "TAXA DE FILIAÇÃO" → "TAXA DE ADESÃO"
Linhas 741-750: "TAXA DE FILIAÇÃO" → "TAXA DE ADESÃO"

## Resumo de edições

| Linha(s) | Problema | Mudança |
|---|---|---|
| 1033 | P1: truncamento | `splitTextToSize` + quebra de linha |
| 1069 | P3: nomenclatura | "Taxa de Filiação" → "Taxa de Adesão" |
| 1075 | P2: valor errado | `valorAdesao + valorMensal` → `valorAdesao` |
| 583, 747 | P3: nomenclatura | "TAXA DE FILIAÇÃO" → "TAXA DE ADESÃO" |
| 1345-1431 | P4: card grande | Reduzir altura e reposicionar preço |
| 1784-1798 | P5: espaço | Rodapé dinâmico |
| 957-982 | P6: badge | Adicionar label "MAIS COMPLETO" |

