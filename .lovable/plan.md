

# Fix: Logo do PDF em Tamanho Original (Proporcional)

## Problema

A logo no header do PDF esta sendo renderizada com dimensoes fixas quadradas (40x40mm no PDF simples, 32x32mm no comparativo), o que distorce a imagem pois o logo "PraticCar" e retangular (mais largo que alto). O resultado e um logo esticado/comprimido verticalmente.

## Solucao

Carregar a imagem da logo em um elemento `Image` do navegador para obter suas dimensoes naturais (largura x altura), e entao calcular as dimensoes proporcionais para o PDF mantendo a proporcao original (aspect ratio).

## Detalhes Tecnicos

### Arquivo: `src/lib/gerarPdfCotacao.ts`

### 1. Nova funcao utilitaria: `loadImageWithDimensions`

Criar uma funcao que retorna tanto o base64 quanto as dimensoes naturais da imagem:

```
async function loadImageWithDimensions(url): Promise<{ base64, width, height } | null>
```

Carrega a imagem em um `new Image()`, espera o `onload`, e retorna `naturalWidth` e `naturalHeight` junto com o base64.

### 2. Ajustar header do PDF simples (linha ~330)

Atual: `doc.addImage(logoBase64, 'PNG', margin, 8, 40, 40)`

Novo: Calcular largura proporcional baseada na altura desejada do header (ex: altura = 35mm, largura = 35 * (naturalWidth / naturalHeight)). Isso preserva o aspect ratio.

### 3. Ajustar header do PDF comparativo/capa (linha ~869)

Atual: `doc.addImage(logoBase64, 'PNG', margin, 5, 32, 32)`

Novo: Mesma logica -- altura = 28mm, largura proporcional.

### 4. Ajustar rodape do PDF simples (linha ~626)

Atual: `doc.addImage(logoBase64, 'PNG', margin, footerY + 2, 18, 18)`

Novo: Altura = 14mm, largura proporcional.

### 5. Ajustar rodape compacto (linha ~718)

Atual: `doc.addImage(logoBase64, 'PNG', margin, footerY + 2, 14, 14)`

Novo: Altura = 12mm, largura proporcional.

### 6. Ajustar posicao do texto ao lado da logo

Como a largura da logo muda (sera mais larga que antes), os `titleX` que posicionam o texto "PRATICCAR" ao lado da logo precisam ser recalculados usando a largura real da logo + margem.

### Resumo das alteracoes

- Alterar `loadImageAsBase64` ou criar funcao complementar que retorna dimensoes
- Passar dimensoes da logo para as funcoes de desenho
- Calcular largura proporcional em cada `addImage` da logo
- Ajustar `titleX` em todos os headers para usar a largura real da logo
- Apenas o arquivo `src/lib/gerarPdfCotacao.ts` sera modificado
