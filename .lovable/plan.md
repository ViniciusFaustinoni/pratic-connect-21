

## Correção: OCR confundindo O com 0 na validação de placa do CRLV

### Problema
A função `normalizePlaca` na linha 201 de `UnifiedDocumentUploader.tsx` apenas remove hífens e espaços, mas não trata a ambiguidade entre a letra "O" e o número "0". O OCR leu `Q005C17` enquanto a cotação tem `QOO5C17` — são a mesma placa, mas a comparação falha.

### Correção

**`src/components/contratos/UnifiedDocumentUploader.tsx`** — linha 201

Alterar a função `normalizePlaca` para normalizar O↔0 conforme o padrão de placas brasileiras (3 letras + 1 número + 1 letra/número + 2 números no Mercosul, ou 3 letras + 4 números no antigo):

```typescript
const normalizePlaca = (p: string) => {
  // Remove caracteres especiais e uppercase
  const clean = p.replace(/[-\s]/g, '').toUpperCase();
  // Normaliza O↔0: nas posições que devem ser letras, converte 0→O; nas posições numéricas, converte O→0
  if (clean.length === 7) {
    return clean.split('').map((ch, i) => {
      // Posições 0,1,2 = letras; posição 4 pode ser letra (Mercosul) ou número
      const isLetterPos = i <= 2 || i === 4;
      const isDigitPos = i === 3 || i === 5 || i === 6;
      if (isLetterPos && ch === '0') return 'O';
      if (isDigitPos && ch === 'O') return '0';
      return ch;
    }).join('');
  }
  return clean;
};
```

### Escopo
- 1 função alterada em 1 arquivo
- Nenhum deploy de Edge Function necessário

