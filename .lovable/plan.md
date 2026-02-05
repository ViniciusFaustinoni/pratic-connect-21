
## Problema Identificado

O PDF comparativo **GERADO CORRETAMENTE** em relação à estrutura (capa + tabela), mas a página de capa (primeira página) com os cards dos planos pode ser **otimizada visualmente** para exibir:
- **Alinhamento e Centralização**: Cards lado a lado com melhor distribuição
- **Ordem dos Planos**: Respeitar ordem de exibição e destaque
- **Espaçamento**: Distribuição uniforme entre os cards
- **Compatibilidade**: Suportar 1 a 6+ planos na mesma página

## Situação Atual

Na função `desenharPaginaCapa()` (linhas 852-925), os cards são:
- ✅ Centralizados horizontalmente
- ✅ Distribuídos em linhas (máximo 3 por linha)
- ✅ Com destaque para o "recomendado" (vermelho/glow)
- ⚠️ Pode melhorar: altura fixa, espaçamento adaptativo

## Solução Proposta

Refatorar a função `desenharPaginaCapa()` para:

1. **Cálculo Dinâmico**: Distribuir N planos em linhas de forma mais inteligente
2. **Altura Responsiva**: Ajustar altura dos cards conforme quantidade
3. **Espaçamento Uniforme**: Usar gap consistente entre cards
4. **Alinhamento Central**: Garantir que os 3 cards fiquem centralizados como na imagem
5. **Suporte a Muitos Planos**: Se houver >3 planos, distribuir em múltiplas linhas

### Mudanças no Arquivo

**Arquivo**: `src/lib/gerarPdfCotacao.ts`

**Mudanças** (linhas 852-925):

1. **Cálculo mais inteligente de layout**:
   - Determinar número de colunas: 1 se só 1 plano, 2 se 2-3 planos, 3 se 3+ planos
   - Largura dos cards ajustada dinamicamente

2. **Cards com valores em coluna própria**:
   - Nome do plano (sem quebra agressiva)
   - Preço mensal em destaque (maior fonte)
   - Badge FIPE alinhado

3. **Tabela de valores centralizada**:
   - Distribuir valores (taxa adesão + mensal) abaixo dos cards
   - Alinhamento decimal dos valores

### Exemplo do Resultado

Para 3 planos como na imagem:
```
┌─────────────────────────────────────────────────────────┐
│        CARD 1          CARD 2          CARD 3           │
│   SELECT EXCLUXO    SELECT PREMIUM    SELECT BASIC      │
│   R$ 214,50/mês     R$ 184,50/mês     R$ 154,50/mês     │
│   ✓ Roubo e Furto   ✓ Roubo e Furto   ✓ Roubo e Furto   │
│   ✓ Colisão         ✓ Colisão         ✓ Colisão         │
│   ...               ...               ...                │
│   [100% FIPE]       [100% FIPE]       [100% FIPE]       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ TAXA DE ADESÃO      R$ XXX    R$ XXX    R$ XXX          │
│ VALOR MÉDIO MENSAL  R$ 214,50 R$ 184,50 R$ 154,50       │
└─────────────────────────────────────────────────────────┘
```

### Modificações Específicas

**Linhas 852-925**: Refatorar o loop que desenha os cards para:

```typescript
// Determinar número de colunas baseado na quantidade de planos
const numPlanos = cotacao.planosComparar.length;
let MAX_CARDS_POR_LINHA = 3;
if (numPlanos === 1) MAX_CARDS_POR_LINHA = 1;
if (numPlanos === 2) MAX_CARDS_POR_LINHA = 2;

// Largura e altura mais apropriadas
const cardGap = 8;  // Aumentado de 6
const baseCardWidth = Math.min(65, (contentWidth - (cardGap * (MAX_CARDS_POR_LINHA - 1))) / MAX_CARDS_POR_LINHA);
const cardWidth = baseCardWidth;
const cardHeight = 80;  // Aumentado para melhor distribuição do conteúdo

// Loop refatorado com melhor lógica de centering
cotacao.planosComparar.forEach((plano, index) => {
  const linhaAtual = Math.floor(index / MAX_CARDS_POR_LINHA);
  const posicaoNaLinha = index % MAX_CARDS_POR_LINHA;
  const planosNestaLinha = Math.min(MAX_CARDS_POR_LINHA, numPlanos - (linhaAtual * MAX_CARDS_POR_LINHA));
  
  // Largura total dos cards + gaps nesta linha
  const larguraLinha = (cardWidth * planosNestaLinha) + (cardGap * Math.max(0, planosNestaLinha - 1));
  
  // Centralizar a linha inteira
  const startX = (pageWidth - larguraLinha) / 2;
  const cardX = startX + (cardWidth + cardGap) * posicaoNaLinha;
  const cardY = y + (cardHeight + cardGap) * linhaAtual;
  
  // ... resto do código para desenhar card
});
```

### Arquivos Afetados

| Arquivo | Linhas | Modificação |
|---------|--------|-------------|
| `src/lib/gerarPdfCotacao.ts` | 852-925 | Refatorar `desenharPaginaCapa()` para centralização dinâmica |
| `.lovable/plan.md` | — | Atualizar documentação |

### Impacto

- ✅ PDF comparativo com cards alinhados como na imagem do usuário
- ✅ Suporte a qualquer número de planos (1, 2, 3, 6+)
- ✅ Melhor utilização do espaço da página
- ✅ Distribuição mais equilibrada dos valores
- ✅ Não quebra funcionalidade existente

