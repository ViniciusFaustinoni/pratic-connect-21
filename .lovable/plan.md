

# Plano: Redesign do PDF Comparativo de Cotação

## Problemas identificados

| # | Problema | Causa no código |
|---|----------|----------------|
| 1 | Modelo do carro cortado | `truncateText(..., 35)` na linha 1081 — "Fiat Idea A.Ext./A..Ext.Loc.Dual. 1.8 Flex 5p" excede 35 chars |
| 2 | Falta dados do Consultor | `vendedor` só é usado no botão WhatsApp do rodapé, não há seção dedicada |
| 3 | Layout genérico | Tema escuro padrão, sem usar a identidade visual da marca de forma destacada |
| 4 | Fonte pequena | Dados do cliente/veículo usam `setFontSize(7)` — praticamente ilegível |
| 5 | Filiação perto da mensalidade | No card, "Filiação: R$494,61" fica logo abaixo das coberturas, sem destaque visual separando da mensalidade |
| 6 | Falta detalhamento de cobertura | A função `desenharPaginaDetalhesPlano` existe mas NÃO é chamada no fluxo comparativo (`gerarPdfCotacaoComparativa` gera só 2 páginas: capa + comparativo) |

## Solução

Todas as alterações concentradas em um único arquivo: `src/lib/gerarPdfCotacao.ts`

### 1. Modelo do carro sem truncar
- Usar `splitTextToSize` em vez de `truncateText` para o nome do veículo
- Permitir que o texto quebre em 2 linhas se necessário
- Aumentar a altura do box de dados do veículo dinamicamente

### 2. Seção do Consultor/Vendedor na capa
- Adicionar uma barra com dados do vendedor (nome + WhatsApp) logo abaixo dos dados do cliente
- Usar o campo `cotacao.vendedor` que já existe na interface `CotacaoComparativaParaPdf`
- Estilo: ícone de telefone + nome do consultor em destaque

### 3. Identidade visual melhorada
- Header: logo maior, gradiente mais pronunciado usando cores da marca
- Cards dos planos: usar cor primária da config como fundo do header do card (em vez do azul genérico `glowBlue`)
- Barra de validade: cor primária como fundo em vez do cinza escuro

### 4. Fontes maiores
- Dados do cliente/veículo: de `7pt` para `9pt`
- Labels (Cliente:, Tel:, Veículo:): de `7pt` para `8pt`
- Coberturas nos cards: de `7pt`/`9pt` para `8pt`/`9pt` (compact/normal)
- Aumentar altura das caixas de dados de `22px` para `30px` para acomodar

### 5. Separar filiação da mensalidade
- Adicionar separador visual mais espesso entre coberturas e filiação
- Mover filiação para fora do card principal, em uma barra separada abaixo
- Ou: criar mini-card de "Investimento" no rodapé do card com fundo diferenciado contendo mensalidade + filiação lado a lado

### 6. Adicionar páginas de detalhamento por plano
- Na função `gerarPdfCotacaoComparativa`, após a capa e antes do comparativo, inserir uma página de detalhes para cada plano usando `desenharPaginaDetalhesPlano` (que já existe)
- Atualizar `totalPaginas` para refletir: 1 (capa) + N (detalhes por plano) + 1 (comparativo)
- Cada página de detalhes mostra: coberturas incluídas, não incluídas, removidas, valores, cota, alerta de deságio

## Detalhes técnicos

Arquivo: `src/lib/gerarPdfCotacao.ts`

### Alteração na `desenharPaginaCapa`
- Box de dados: aumentar altura, fontes maiores, `splitTextToSize` para modelo
- Nova linha de vendedor dentro do box de dados
- Cards: filiação em mini-seção separada com fundo diferenciado

### Alteração na `gerarPdfCotacaoComparativa`
- Calcular `totalPaginas = 1 + numPlanos + 1`
- Loop para gerar página de detalhes por plano entre capa e comparativo
- Chamar `desenharPaginaDetalhesPlano` para cada plano

### Ajustes de fonte globais
- Constantes `FONT_DATA = 9`, `FONT_LABEL = 8` para consistência

