

# Melhorias no PDF de Cotação

## Análise dos 6 pontos solicitados

### 1. Imagem do carro cortada
O código carrega `/vehicle-silhouette.png` no PDF simples (linha 338) mas **nunca a desenha** — a variável `vehicleBase64` não é usada. No PDF comparativo, a imagem nem é carregada. Solução: renderizar a imagem com aspect ratio correto na capa/seção do veículo.

### 2. Dados do Consultor
O PDF comparativo já exibe dados do consultor na capa (`showConsultor`, linhas 1147-1167). Porém o **PDF simples** (`gerarPdfCotacao`) não recebe nem exibe dados do consultor. Solução: adicionar seção de consultor no PDF simples e garantir que `BotaoGerarPdf` passe os dados do vendedor.

### 3. Identidade Visual (cores, logo, fontes)
O sistema já carrega config do banco (`cotacao_pdf_config`) com cores e logo. O problema é que muitas cores no código são **hardcoded** (ex: `bodyBg`, `cardBg`, `sectionHeaderBg`) e não refletem a config. Solução: usar `cor_primaria` e `cor_secundaria` da config nos elementos principais (headers, barras, badges).

### 4. Tamanho da Fonte
Fontes de dados estão em 8-9pt, difícil de ler. Solução: aumentar para 10-11pt nos dados principais, 12pt nos labels de seção, manter 8pt apenas em disclaimers/rodapé.

### 5. Taxa de Filiação destacada
A taxa de adesão aparece como texto muted pequeno (9pt) abaixo do card de valor mensal. Solução: colocar a taxa de filiação dentro do card principal do plano, lado a lado ou logo abaixo do valor mensal, com destaque visual.

### 6. Seção de Detalhamento de Cobertura
As coberturas são listadas apenas com nome curto. Solução: se os planos tiverem descrições detalhadas (como "Reboque para Colisão — Ilimitado somente em caso de acionamento"), exibi-las. Para o PDF simples, expandir a seção de coberturas para mostrar descrições quando disponíveis.

## Alterações técnicas

### `src/lib/gerarPdfCotacao.ts`

**gerarPdfCotacao (PDF simples):**
- Renderizar imagem do veículo com `objectFit: contain` na seção do veículo
- Adicionar seção "CONSULTOR RESPONSÁVEL" com nome, WhatsApp e telefone
- Aumentar fontes: dados para 10pt, labels para 11pt, valores para 16-18pt
- Mover Taxa de Filiação para dentro do card do plano, com destaque visual
- Expandir coberturas para mostrar descrição quando disponível
- Aplicar `cor_primaria`/`cor_secundaria` da config nos headers e gradientes

**gerarPdfCotacaoComparativa (PDF comparativo):**
- Mesmos ajustes de fonte
- Garantir que imagem do veículo não fique cortada
- Taxa de filiação mais proeminente nos cards de plano

### `src/components/cotacoes/BotaoGerarPdf.tsx`
- Já passa `profiles` (vendedor) — verificar que chegue ao PDF simples também

### `src/lib/gerarPdfCotacao.ts` — Interfaces
- Adicionar campo `vendedor` opcional em `CotacaoParaPdf`
- Adicionar campo `coberturas_detalhadas` opcional em `PlanoParaPdf`

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/lib/gerarPdfCotacao.ts` | Aplicar todos os 6 ajustes no PDF simples e comparativo |
| `src/components/cotacoes/BotaoGerarPdf.tsx` | Passar dados do vendedor ao PDF simples |

