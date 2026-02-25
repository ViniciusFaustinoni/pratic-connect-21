

# Remover Pagina "TABELA COMPARATIVA DE COBERTURAS" do PDF

## Problema

O PDF comparativo gera uma segunda pagina com o titulo "TABELA COMPARATIVA DE COBERTURAS" contendo uma tabela com checks de coberturas por plano. Essa pagina nao deve mais existir.

## Solucao

Remover a chamada da pagina comparativa e a propria funcao do arquivo `src/lib/gerarPdfCotacao.ts`.

## Detalhes Tecnicos

### Arquivo: `src/lib/gerarPdfCotacao.ts`

1. **Remover o bloco de chamada** (linhas 1501-1515): O trecho que adiciona a pagina 2 com `desenharPaginaComparativa` sera removido inteiramente, incluindo o `doc.addPage()` e a chamada da funcao.

2. **Remover a funcao `desenharPaginaComparativa`** (linhas 1319-1516 aproximadamente): Toda a funcao que desenha a tabela comparativa sera removida, ja que nao sera mais utilizada.

3. **Simplificar calculo de `totalPaginas`**: Atualmente o total de paginas considera a pagina comparativa. Sera ajustado para sempre ser 1 (apenas a capa), removendo a logica condicional baseada em `numPlanos > 1`.

4. **Ajustar `isCapaUltimaPagina`**: Sempre sera `true`, ja que a capa sera a unica pagina.

