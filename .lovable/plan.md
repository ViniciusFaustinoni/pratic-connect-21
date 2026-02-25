

# Fix: Overflow nas Coberturas do PDF da Cotacao Comparativa

## Problema

Na pagina 1 (capa) do PDF comparativo, quando ha 3 planos lado a lado, as coberturas apresentam dois problemas de overflow:

1. **Overflow horizontal**: O texto das coberturas nao e truncado para caber na largura do card. Textos como "Rastreador/Monitoramento (acima de R$30mil)" ultrapassam a borda do card.
2. **Overflow vertical**: Com ate 14 coberturas por card (lineHeight=7), os cards podem ultrapassar o limite inferior da pagina, especialmente com 3 cards.

## Solucao

Ajustar a funcao `desenharCardPlanoExpandido` em `src/lib/gerarPdfCotacao.ts`:

### 1. Truncar texto das coberturas

Na linha onde o texto da cobertura e desenhado (linha ~810), usar `truncateText` com base na largura disponivel do card. A largura util e `width - padding*2 - 8` (8px para o circulo verde). Calcular o numero maximo de caracteres proporcionalmente a largura do card.

### 2. Reduzir maxCoberturas para 3 cards

Quando os cards sao estreitos (3 por linha), limitar a 10-12 coberturas em vez de 14, e reduzir o fontSize e lineHeight para que tudo caiba. O layout atual usa:
- `lineHeight = 7` e `maxCoberturas = 14` -- resulta em ~98px so para coberturas
- Com header (24) + valor (28) + coberturas (98) + rodape (18) = ~168px + o Y inicial (~100px) = ~268px, ultrapassando os ~297px da pagina A4

### 3. Ajustes especificos

- Reduzir `maxCoberturas` de 14 para 10 quando ha 3+ planos
- Reduzir `fontSize` das coberturas de 9 para 7 quando ha 3+ planos  
- Reduzir `lineHeight` de 7 para 5.5 quando ha 3+ planos
- Truncar o texto de cada cobertura com base na largura disponivel do card (caracteres calculados proporcionalmente: ~`(width - padding*2 - 8) / 1.8` para fontSize 7)

## Detalhes Tecnicos

### Arquivo: `src/lib/gerarPdfCotacao.ts`

**Funcao `desenharCardPlanoExpandido`** (linha 740-839):

Adicionar parametro opcional `compact: boolean = false` para indicar layout compacto (3+ planos).

Quando `compact = true`:
- `maxCoberturas = 10`
- `lineHeight = 5.5`
- fontSize coberturas: 7 (em vez de 9)
- Truncar cada cobertura: `truncateText(cobertura, maxChars)` onde `maxChars = Math.floor((width - padding*2 - 8) / 1.6)`

**Funcao `desenharPaginaCapa`** (linha 842-993):

No bloco de 3+ cards (linha 966-988):
- Passar `compact = true` ao chamar `desenharCardPlanoExpandido`
- Recalcular `estimatedCardHeight` com os novos valores (menos coberturas, menor lineHeight)

No bloco de 2 cards (linha 957-963):
- Tambem truncar texto, mas manter fontSize 9 e maxCoberturas 14 (cards sao mais largos)

### Sem alteracoes em outros arquivos

Apenas `src/lib/gerarPdfCotacao.ts` sera modificado.

