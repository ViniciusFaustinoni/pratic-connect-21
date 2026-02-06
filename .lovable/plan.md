

## Plano: Ajustes no PDF de Cotação

### Alterações Solicitadas

| Item | Situação Atual | Alteração |
|------|----------------|-----------|
| Fonte das coberturas | 6.5pt (comparativo) e 8pt (normal) | Aumentar para **9pt** em ambos |
| Truncamento de texto | `truncateText(cobertura, 30)` e `maxChars` | Exibir texto completo sem truncar |
| Círculo amarelo "1°" | Badge de ranking no plano recomendado | Remover completamente |

---

### Modificações no Arquivo

**Arquivo:** `src/lib/gerarPdfCotacao.ts`

---

#### 1. Aumentar fonte das coberturas no PDF normal (linhas 521 e 537)

```typescript
// De:
doc.setFontSize(8);

// Para:
doc.setFontSize(9);
```

#### 2. Aumentar fonte das coberturas no PDF comparativo (linha 819)

```typescript
// De:
doc.setFontSize(6.5);

// Para:
doc.setFontSize(9);
```

#### 3. Remover truncamento das coberturas no PDF normal (linhas 523 e 539)

```typescript
// De:
doc.text(truncateText(cobertura, 30), cobCol1X + 12, textY);
doc.text(truncateText(cobertura, 30), cobCol2X + 9, textY);

// Para:
doc.text(cobertura, cobCol1X + 12, textY);
doc.text(cobertura, cobCol2X + 9, textY);
```

#### 4. Remover truncamento das coberturas no PDF comparativo (linha 824)

```typescript
// De:
const maxChars = Math.floor((width - 20) / 2);
doc.text(truncateText(cobertura, maxChars), x + padding + 8, currentY);

// Para:
doc.text(cobertura, x + padding + 8, currentY);
```

#### 5. Remover círculo amarelo "1°" do título do plano (linhas 774-783)

```typescript
// REMOVER este bloco inteiro:
if (isRecommended) {
  const badgeSize = 14;
  doc.setFillColor(warningYellow.r, warningYellow.g, warningYellow.b);
  doc.circle(x + width - 10, currentY + 6, badgeSize / 2, 'F');
  doc.setTextColor(premiumDark.r, premiumDark.g, premiumDark.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('1°', x + width - 10, currentY + 8.5, { align: 'center' });
}
```

#### 6. Ajustar centralização do nome do plano após remover badge (linhas 790-792)

```typescript
// De:
const nomeLines = doc.splitTextToSize(plano.nome.toUpperCase(), width - (isRecommended ? 24 : 12));
const lineToShow = nomeLines[0];
doc.text(lineToShow, x + width / 2 - (isRecommended ? 6 : 0), currentY + 9, { align: 'center' });

// Para:
const nomeLines = doc.splitTextToSize(plano.nome.toUpperCase(), width - 12);
const lineToShow = nomeLines[0];
doc.text(lineToShow, x + width / 2, currentY + 9, { align: 'center' });
```

---

### Resumo das Alterações

| Local | Linha(s) | Alteração |
|-------|----------|-----------|
| PDF Normal - Fonte coberturas | 521, 537 | 8pt → 9pt |
| PDF Normal - Truncamento | 523, 539 | Remover `truncateText()` |
| PDF Comparativo - Fonte coberturas | 819 | 6.5pt → 9pt |
| PDF Comparativo - Truncamento | 822-824 | Remover `maxChars` e `truncateText()` |
| PDF Comparativo - Badge amarelo | 774-783 | Remover bloco inteiro |
| PDF Comparativo - Centralização nome | 790-792 | Remover offset condicional |

---

### Resultado Esperado

Após as alterações:
- As coberturas terão **fonte maior (9pt)** e mais legível
- Os nomes das coberturas serão exibidos **completos, sem abreviações**
- O **círculo amarelo com "1°"** será removido do título do plano no PDF comparativo
- O nome do plano ficará **centralizado corretamente** sem o offset do badge

