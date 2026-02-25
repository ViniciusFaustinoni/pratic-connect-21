

# Aplicar Tema Híbrido no PDF: Topo/Rodapé Claros + Corpo Escuro

## O que muda

O PDF atualmente usa tema 100% claro (fundo branco em todo lugar). O formato desejado (conforme o PDF enviado) tem:
- **Topo (header)**: fundo claro/branco com logo escura e gradiente azul-vermelho
- **Corpo**: fundo escuro (cinza escuro/slate-800) com texto claro, cards com bordas coloridas
- **Rodapé**: fundo claro com logo escura

## Alteracoes Tecnicas

### Arquivo: `src/lib/gerarPdfCotacao.ts`

### 1. Restaurar paleta de cores para corpo escuro
Alterar as constantes de cor (linhas 84-102):
- `cardBg`: de branco para escuro (~slate-800: `{r:30, g:41, b:59}`)
- `cardBorder`: para tons escuros (`{r:51, g:65, b:85}`)
- `sectionHeaderBg`: para slate-700 (`{r:51, g:65, b:85}`)
- `stripeBg`: para slate-750 (`{r:40, g:52, b:70}`)
- `textLight`: voltar para branco/claro (`{r:226, g:232, b:240}`)
- `textMuted`: tom mais claro para contraste (`{r:148, g:163, b:184}`)
- `successGreen`: voltar para verde mais brilhante (`{r:34, g:197, b:94}`)
- `warningYellow`: voltar para amarelo mais brilhante (`{r:234, g:179, b:8}`)
- Manter `headerFooterBg` claro como esta

### 2. Fundo escuro na area de conteudo
- `drawPageBackground`: pintar fundo escuro (slate-800) em vez de branco
- Header e footer continuam usando `headerFooterBg` (claro)

### 3. Ajustar textos no corpo do PDF
- Textos de labels e valores no corpo devem ser claros (branco/light slate)
- Textos no header/footer continuam escuros
- Valores de FIPE continuam verdes, validade continua amarela (com brilho para fundo escuro)

### 4. Cards dos planos (comparativo)
- Fundo escuro dos cards com bordas brilhantes (vermelho/azul glow) -- como no PDF enviado
- Texto das coberturas em branco/claro
- Valor mensal em verde brilhante

### 5. Secoes de header (DADOS DO SOLICITANTE, COBERTURAS, etc.)
- Fundo slate-700 em vez de slate-100
- Texto do titulo em branco em vez de escuro
- Indicador visual azul mantido

### 6. Barras de validade e info do cliente/veiculo
- Fundo escuro (compativel com corpo)
- Texto claro

### 7. Taxa de adesao e "Nao Inclui" na pagina de detalhes
- Texto claro para fundo escuro

Nenhuma alteracao de layout, estrutura, logo ou banco de dados. Apenas troca de cores para o corpo do PDF.
