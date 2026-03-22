

# Plano: Página "Comparativo de Coberturas" no final dos PDFs

## Resumo

Adicionar uma nova função `desenharPaginaComparativoCoberturas` e chamá-la como última página em ambos os PDFs (simples e comparativo).

## Nova função `desenharPaginaComparativoCoberturas`

Parâmetros: `doc`, `cotacao` (ou dados de veículo/número), `planos: PlanoParaPdf[]`, `logoBase64`, `pageWidth`, `pageHeight`, `margin`, `paginaAtual`, `totalPaginas`, `logoAspect`, `config`.

### Estrutura da página

1. **Background** — `drawPageBackground`
2. **Header compacto** — mesmo padrão de `desenharPaginaDetalhesPlano`: fundo claro, gradiente, título "COMPARATIVO DE COBERTURAS", dados do veículo à direita (respeitando `mostrar_dados_veiculo`)
3. **Tabela de coberturas**:
   - Coletar todas as coberturas únicas de todos os planos (union sem duplicatas)
   - Coluna 1: nome da cobertura
   - Colunas 2..N: uma por plano, cabeçalho com nome do plano usando `cor_primaria`/`brandBlue`
   - Célula: `✓` verde (`successGreen`) se o plano inclui, `✗` vermelho (`glowRed`) se não
   - Linhas alternadas: fundo `stripeBg` nas pares para zebra
   - Cabeçalho da tabela: fundo `brandBlue`/`cor_primaria`, texto branco
4. **Rodapé** — `desenharRodapeCompacto` (já respeita toggles)

### Integração

**`gerarPdfCotacao` (simples, ~1 plano)**:
- Antes do `doc.save()` (linha 678), adicionar nova página com `doc.addPage()` e chamar `desenharPaginaComparativoCoberturas` com o plano único convertido
- Construir array de 1 `PlanoParaPdf` a partir dos dados da cotação simples

**`gerarPdfCotacaoComparativa` (multi-plano)**:
- Antes do `doc.save()` (linha 1293), adicionar `doc.addPage()` e chamar a função com `cotacao.planosComparar`
- Atualizar `totalPaginas` para incluir a nova página

## Arquivo afetado

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/gerarPdfCotacao.ts` | Nova função + chamadas em ambos os geradores |

