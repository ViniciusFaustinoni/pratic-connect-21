

## Plano: Redesenhar Cards dos Planos no PDF Comparativo

### Problema Atual

O PDF comparativo atual exibe cards de planos compactos na página de capa, mas com layout diferente da interface web (imagem de referência). O usuário deseja que os cards do PDF tenham:

1. **Nome do plano** centralizado no topo com borda/destaque
2. **Valor mensal** grande e centralizado logo abaixo
3. **Lista de coberturas** com checkmarks verdes, alinhadas à esquerda
4. **Filiação/Adesão** no rodapé do card

### Layout de Referência (da imagem)

```
┌─────────────────────────────────────────┐
│        SELECT EXCLUSIVE           1°    │  ← Badge de ranking (opcional)
├─────────────────────────────────────────┤
│                                         │
│          R$ 206,00/mês                 │  ← Valor centralizado e grande
│                                         │
│  ✓ Roubo e Furto                       │
│  ✓ Colisão                              │
│  ✓ Perda Total                          │
│  ✓ Incêndio                             │
│  ✓ Alagamento                           │
│  ✓ Chuva de Granizo                     │
│  ✓ Assistência 24h 400km                │
│  ✓ Rastreador/Monitoramento (...)       │
│  ✓ 1000km Reboque                       │
│  ✓ Danos Terceiros R$40mil              │
│  ✓ Vidros e Faróis (após 120 dia...)    │
│  ✓ Reboque Excedente (1x a ca...)       │
│  ✓ Kit Gás                              │
│  ✓ 100% FIPE APP + Carro Res...         │
│                                         │
│  ─ Ver menos                            │  ← (opcional no PDF)
├─────────────────────────────────────────┤
│  Filiação: R$ 0,00                      │  ← Taxa de adesão no rodapé
└─────────────────────────────────────────┘
```

### Alterações Propostas

#### 1. Modificar a página de capa (`desenharPaginaCapa`)

Substituir os cards compactos (80px altura) por **cards verticais expandidos** que mostram todas as coberturas de cada plano, similar à interface web.

**Novo layout do card:**
- Largura: Variável baseada na quantidade de planos (1 plano = 100% largura, 2 planos = 50% cada, 3+ = scroll ou múltiplas linhas)
- Altura: Dinâmica baseada no número de coberturas
- Estrutura interna:
  1. Header com nome do plano (fundo azul/destaque)
  2. Valor mensal grande centralizado
  3. Separador "/mês" em texto menor
  4. Lista de coberturas com check verde
  5. Rodapé com taxa de filiação/adesão

#### 2. Considerar limitação de espaço

Como uma página A4 tem espaço limitado (~297mm de altura), para planos com muitas coberturas:
- Exibir até 12-14 coberturas por card
- Se houver mais, indicar "..." ou continuar na página de detalhes

#### 3. Centralização

- Cards centralizados horizontalmente na página
- Conteúdo interno (nome, valor, coberturas) com alinhamento consistente
- Espaçamento uniforme entre cards

---

### Detalhes Técnicos

**Arquivo a modificar:** `src/lib/gerarPdfCotacao.ts`

**Função a modificar:** `desenharPaginaCapa` (linhas 740-1001)

**Alterações principais:**

```typescript
// Novo card expandido para planos
const desenharCardPlanoExpandido = (
  doc: jsPDF,
  plano: PlanoParaPdf,
  x: number,
  y: number,
  width: number,
  index: number
): number => { // Retorna a altura final do card
  
  const padding = 8;
  const lineHeight = 9;
  const maxCoberturas = 12; // Limitar para caber na página
  
  // Calcular altura baseada nas coberturas
  const numCoberturas = Math.min(plano.coberturas.length, maxCoberturas);
  const cardHeight = 
    30 +  // Header (nome do plano)
    35 +  // Valor mensal
    (numCoberturas * lineHeight) + // Coberturas
    25;   // Rodapé (filiação)
  
  // Fundo do card
  drawPremiumCard(doc, x, y, width, cardHeight, { 
    isRecommended: index === 0, 
    hasGlow: true 
  });
  
  let currentY = y + 8;
  
  // 1. Header: Nome do plano centralizado
  doc.setFillColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.roundedRect(x + 4, currentY - 4, width - 8, 18, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(plano.nome.toUpperCase(), x + width / 2, currentY + 7, { align: 'center' });
  currentY += 22;
  
  // 2. Valor mensal grande
  doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(plano.valorMensal), x + width / 2, currentY, { align: 'center' });
  currentY += 6;
  
  // 3. "/mês" em texto menor
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('/mês', x + width / 2, currentY, { align: 'center' });
  currentY += 12;
  
  // 4. Lista de coberturas
  const coberturasExibir = plano.coberturas.slice(0, maxCoberturas);
  coberturasExibir.forEach((cobertura) => {
    // Check verde
    doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
    doc.circle(x + padding + 4, currentY - 1.5, 1.5, 'F');
    
    // Texto da cobertura
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(truncateText(cobertura, 30), x + padding + 10, currentY);
    
    currentY += lineHeight;
  });
  
  // Se tem mais coberturas, indicar
  if (plano.coberturas.length > maxCoberturas) {
    doc.setTextColor(glowBlue.r, glowBlue.g, glowBlue.b);
    doc.setFontSize(7);
    doc.text(`+ ${plano.coberturas.length - maxCoberturas} mais...`, x + width / 2, currentY, { align: 'center' });
    currentY += 8;
  }
  
  currentY += 4;
  
  // 5. Rodapé: Filiação (taxa de adesão)
  doc.setDrawColor(premiumCardLight.r, premiumCardLight.g, premiumCardLight.b);
  doc.line(x + padding, currentY - 4, x + width - padding, currentY - 4);
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Filiação:', x + padding, currentY);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(plano.valorAdesao), x + width - padding, currentY, { align: 'right' });
  
  return cardHeight;
};
```

**Modificação na lógica de layout:**

```typescript
// Na função desenharPaginaCapa, após desenhar header e dados do cliente
// Desenhar cards em layout responsivo

const numPlanos = cotacao.planosComparar.length;

if (numPlanos === 1) {
  // Card único centralizado (largura 70% da página)
  const cardWidth = contentWidth * 0.7;
  const cardX = (pageWidth - cardWidth) / 2;
  desenharCardPlanoExpandido(doc, cotacao.planosComparar[0], cardX, y, cardWidth, 0);
  
} else if (numPlanos === 2) {
  // 2 cards lado a lado
  const cardWidth = (contentWidth - 10) / 2;
  cotacao.planosComparar.forEach((plano, index) => {
    const cardX = margin + (cardWidth + 10) * index;
    desenharCardPlanoExpandido(doc, plano, cardX, y, cardWidth, index);
  });
  
} else {
  // 3+ cards: Layout em múltiplas linhas ou cards mais compactos
  const cardsPerRow = 3;
  const cardGap = 6;
  const cardWidth = (contentWidth - (cardGap * (cardsPerRow - 1))) / cardsPerRow;
  
  cotacao.planosComparar.forEach((plano, index) => {
    const row = Math.floor(index / cardsPerRow);
    const col = index % cardsPerRow;
    const cardX = margin + (cardWidth + cardGap) * col;
    const cardY = y + row * 130; // Altura estimada por linha
    
    desenharCardPlanoExpandido(doc, plano, cardX, cardY, cardWidth, index);
  });
}
```

---

### Resultado Esperado

Após as alterações, o PDF comparativo terá:

1. **Cards verticais** com nome do plano em destaque no topo
2. **Valor mensal centralizado** com tamanho grande
3. **Lista de coberturas** alinhadas à esquerda com checks verdes
4. **Taxa de filiação** visível no rodapé de cada card
5. **Espaçamento uniforme** entre elementos
6. **Centralização** de cards na página

O layout final será visualmente similar à interface web mostrada na imagem de referência, mantendo a identidade visual premium do sistema.

