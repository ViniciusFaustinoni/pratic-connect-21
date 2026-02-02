
# Plano: Corrigir Alinhamento de Cards no PDF

## Problema Identificado

Na página de capa do PDF comparativo, os cards dos planos têm os seguintes problemas:
1. O badge **"RECOMENDADO"** (vermelho) não deve existir
2. O badge azul **"100% FIPE"** está desalinhado entre os cards porque a posição Y depende da existência do badge recomendado

## Solução

Remover o badge "RECOMENDADO" e fixar a posição do badge FIPE para que fique sempre na mesma altura em todos os cards.

---

## Alterações

### Arquivo: `src/lib/gerarPdfCotacao.ts`

#### 1. Remover badge "RECOMENDADO" e alinhar elementos (linhas 889-936)

**Antes:**
```typescript
let innerY = cardY + 5;

// Badge de recomendado
if (isRecommended) {
  doc.setFillColor(brandRed.r, brandRed.g, brandRed.b);
  const badgeWidth = cardWidth - 8;
  doc.roundedRect(cardX + 4, innerY - 2, badgeWidth, 9, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text('⭐ RECOMENDADO', centerX, innerY + 4, { align: 'center' });
  innerY += 12;
} else {
  innerY += 3;
}

// Nome do plano...
```

**Depois:**
```typescript
let innerY = cardY + 8; // Posição fixa para todos os cards (sem variação)

// Nome do plano (imediatamente, sem badge RECOMENDADO)
```

---

#### 2. Ajustar posicionamento fixo para elementos

O layout de cada card será:
- **Y+8**: Nome do plano (até 2 linhas)
- **Y+22**: Valor mensal (verde)
- **Y+30**: "médio mensal"
- **Y+40**: Badge FIPE azul (posição fixa)

Isso garante que todos os cards tenham o badge azul **alinhado horizontalmente**.

---

## Visual Esperado

```text
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│                 │  │                 │  │                 │
│ SELECT EXCLUSIVE│  │  SELECT ONE     │  │  SELECT PLUS    │
│   APLICATIVO    │  │   APLICATIVO    │  │   APLICATIVO    │
│                 │  │                 │  │                 │
│   R$ 169,00     │  │   R$ 169,00     │  │   R$ 189,00     │
│  médio mensal   │  │  médio mensal   │  │  médio mensal   │
│                 │  │                 │  │                 │
│  ┌──────────┐   │  │  ┌──────────┐   │  │  ┌──────────┐   │
│  │100% FIPE │   │  │  │100% FIPE │   │  │  │100% FIPE │   │
│  └──────────┘   │  │  └──────────┘   │  │  └──────────┘   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
        ↑                   ↑                   ↑
     ALINHADOS HORIZONTALMENTE (mesma posição Y)
```

---

## Detalhes Técnicos

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/gerarPdfCotacao.ts` | Remover lógica do badge "RECOMENDADO" (linhas 892-904), fixar posição Y do badge FIPE para todos os cards |

---

## Comportamento Após Alteração

- Todos os cards de plano terão layout idêntico
- O nome do plano será exibido no topo (com quebra de linha se necessário)
- O badge azul "X% FIPE" ficará na mesma posição vertical em todos os cards
- A borda vermelha do card recomendado será mantida (apenas o badge é removido)
