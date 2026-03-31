

# Correção do Layout do PDF de Cotação Comparativa

## Problemas identificados

### Páginas 2 e 3 (Detalhe do plano)
1. **Card de valor excessivamente alto** — `valorCardHeight` é fixo em 85mm, mas quando o plano não tem cota/deságio, sobra um vazio enorme dentro do card
2. **Nome do plano duplicado** — aparece no título da página E dentro do card vermelho
3. **Preço posicionado com offset fixo** — `y + 32` e `y + 44` são relativos ao topo do card, não ao conteúdo real, causando o preço flutuando no meio do vazio
4. **Espaço vazio excessivo** entre o card e a seção "COBERTURAS INCLUÍDAS"

### Página 1 (Capa)
5. **Cards com alturas diferentes** — quando um plano tem mais coberturas que outro, os cards ficam desiguais visualmente (mas funcionalmente ok)

### Geral
6. O design é razoável, mas os espaçamentos estão desproporcionais

## Solução

### Arquivo: `src/lib/gerarPdfCotacao.ts`

**1. Tornar `valorCardHeight` dinâmico na função `desenharPaginaDetalhesPlano` (linhas ~1313-1390)**

Em vez de `const valorCardHeight = 85`, calcular com base no conteúdo real:
- Nome do plano: ~16mm
- Badges (FIPE, ano): ~16mm  
- Cota/deságio (se houver): ~12mm por linha
- Preço: ~20mm
- Total dinâmico com padding

**2. Reposicionar o preço para seguir o fluxo de `cardY`**

Atualmente:
```ts
doc.text(formatCurrency(plano.valorMensal), ..., y + 32, ...);  // offset fixo!
doc.text('/mês', ..., y + 44, ...);  // offset fixo!
```

Mudar para usar a posição após as badges/cotas, alinhando o preço à direita na mesma altura do nome do plano ou após os badges.

**3. Equalizar cards na capa (`desenharCardPlanoExpandido`, linhas ~946-1056)**

Calcular a altura máxima entre todos os cards e usar essa altura para todos, garantindo alinhamento visual.

**4. Remover redundância do nome no card de detalhe**

O nome já aparece no header da página (`PLANO ESSENCIAL`). Dentro do card, pode ser substituído por apenas os badges e valores.

## Resumo de mudanças

| Local no código | Problema | Correção |
|---|---|---|
| `desenharPaginaDetalhesPlano` linhas 1313-1390 | Card fixo 85mm, preço com offset fixo | Altura dinâmica, preço no fluxo |
| `desenharCardPlanoExpandido` linhas 946-1056 | Cards com alturas diferentes | Aceitar altura máxima como parâmetro |
| `desenharPaginaCapa` linhas 1222-1261 | Não calcula altura máxima | Pré-calcular e passar para os cards |

