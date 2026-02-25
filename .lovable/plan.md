

# Cotacao PDF com fundo claro (header, footer e corpo)

## Problema atual
O PDF da cotacao usa um tema escuro (dark mode) com fundo slate-900 (#0F172A), cards escuros e texto claro. O usuario quer que o topo (header), rodape (footer) e fundo geral do PDF sejam claros (fundo branco/claro).

## Alteracoes propostas

**Arquivo:** `src/lib/gerarPdfCotacao.ts`

### 1. Paleta de cores - adicionar cores claras
Substituir/adicionar cores para o tema claro:
- Fundo da pagina: branco (#FFFFFF)
- Header: manter gradiente azul PRATIC (brandBlue) mas com fundo mais claro
- Cards: fundo cinza claro (#F8FAFC / slate-50) em vez de slate-900
- Bordas de cards: cinza medio (#E2E8F0 / slate-200)
- Texto principal: escuro (#1E293B / slate-800)
- Texto secundario: cinza (#64748B / slate-500)
- Section headers: fundo azul claro (#EFF6FF / blue-50) com texto escuro
- Footer: fundo cinza claro (#F1F5F9 / slate-100)
- Barras de validade: fundo cinza claro em vez de slate-800

### 2. drawPageBackground
Mudar de `premiumDark` para branco (#FFFFFF).

### 3. Header (ambos PDFs: simples e comparativo)
- Manter o gradiente azul PRATIC no header (identidade visual)
- Logo continua usando `logo-full-light.png` (logo claro sobre fundo azul)
- Texto branco sobre o gradiente permanece

### 4. Barra de validade
- Fundo: cinza claro (#F1F5F9) em vez de slate-800
- Texto: escuro/cinza em vez de claro

### 5. Secoes de dados (Solicitante, Veiculo)
- Labels: cinza medio (#64748B)
- Valores: escuro (#1E293B)
- Fundo alternado nas coberturas: cinza muito claro (#F8FAFC)

### 6. Cards de plano
- Fundo: branco com borda cinza (#E2E8F0)
- Card recomendado: borda azul ou vermelha (mantém glow)
- Nome do plano: fundo azul (mantém)
- Texto das coberturas: escuro
- Check indicators: mantém verde

### 7. Section headers (COBERTURAS, NAO INCLUI, etc.)
- Fundo: azul claro (#EFF6FF)
- Indicador: mantém azul
- Texto: escuro

### 8. Cards de valor (VALOR MENSAL, PRIMEIRO PAGAMENTO)
- VALOR MENSAL: mantém fundo azul (identidade)
- PRIMEIRO PAGAMENTO: mantém fundo verde (destaque)
- Esses cards de destaque ficam com cores fortes propositalmente

### 9. Footer
- Fundo: cinza claro (#F1F5F9) em vez de slate-800
- Texto: escuro/cinza em vez de claro
- Linha gradiente: mantém (azul para vermelho)

### 10. Paginas subsequentes (checkPageBreak)
- Header compacto: mantém gradiente azul
- Background: branco

### 11. Funcoes afetadas
- `drawPageBackground` - fundo branco
- `drawPremiumCard` - fundo claro, borda cinza
- `drawPremiumSectionHeader` - fundo azul claro, texto escuro
- `gerarPdfCotacao` (PDF simples) - todas as referencias de cor
- `desenharPaginaCapa` (PDF comparativo) - cores de dados
- `desenharPaginaDetalhesPlano` - cores de coberturas e valores
- `desenharRodapeCompacto` - fundo e texto claros
- `desenharCardPlanoExpandido` - cores do card

### Resultado esperado
PDF profissional com fundo branco, header azul PRATIC, rodape cinza claro, texto escuro legivel, mantendo os destaques de cor (verde para valores, azul para headers, vermelho para badges).

