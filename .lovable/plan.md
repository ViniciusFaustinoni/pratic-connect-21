

# Plano: Corrigir tabela comparativa de coberturas no PDF

## Problema

1. **Marcadores invisíveis**: `✓`, `✗` e `⚠` são caracteres Unicode que a fonte Helvetica do jsPDF não renderiza — aparecem como pontos minúsculos
2. **Nomes de planos truncados**: `truncateText` com limite de caracteres corta nomes como "SELECT ONE 5%..."

## Solução

### 1. Substituir caracteres Unicode por desenhos vetoriais (linhas 1571-1594)

Em vez de `doc.text('✓'...)`, desenhar formas geométricas com as primitivas do jsPDF:

- **Incluído (verde)**: Círculo preenchido verde (como `drawCheckIndicator` já faz na linha 241)
- **Removido (amarelo)**: Triângulo preenchido amarelo (3 pontos com `doc.triangle`)
- **Não inclui (vermelho)**: X desenhado com duas linhas cruzadas vermelhas (`doc.line`)

### 2. Ajustar largura da coluna de nomes dos planos (linhas 1549-1553)

- Usar `doc.splitTextToSize(plano.nome, colPlanoWidth - 4)` em vez de `truncateText` para quebrar em 2 linhas se necessário
- Aumentar `headerRowHeight` de 14 para 18 para acomodar nomes maiores
- Reduzir `colCoberturaWidth` de 40% para 35% para dar mais espaço aos planos

### 3. Aumentar `rowHeight` de 9 para 10 para melhorar legibilidade

## Arquivo afetado

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/gerarPdfCotacao.ts` | Substituir Unicode por formas vetoriais, ajustar larguras e truncamento na tabela comparativa (linhas 1534-1597) |

