

## Plano: Rubrica em todas as páginas + Assinatura na última

### Problema atual
Todos os 5 edge functions que criam documentos no Autentique usam uma única posição fixa:
```json
positions: [{ x: "65.0", y: "85.0", z: "1", element: "SIGNATURE" }]
```
Isso coloca assinatura apenas na página 1. O correto seria rubrica (INITIALS) em todas as páginas e assinatura (SIGNATURE) na última.

### Solução

A API Autentique aceita o campo `element` com valores `SIGNATURE`, `INITIALS` e `NAME`, e o campo `z` indica a página. Como não sabemos quantas páginas o PDF terá (o HTML é convertido pela Autentique), a estratégia é:

1. **Criar função utilitária em `_shared/autentique-positions.ts`** que gera posições com INITIALS nas páginas 1 a N (usar N=20 como máximo seguro — páginas inexistentes são ignoradas pela Autentique) e SIGNATURE na última página real.

2. **Atualizar os 5 edge functions** para usar essa função:
   - `autentique-create/index.ts`
   - `autentique-create-by-token/index.ts`
   - `autentique-evento-create/index.ts`
   - `autentique-os-saida-create/index.ts`
   - `autentique-cancelamento-create/index.ts`

### Detalhes técnicos

**Nova função utilitária:**
```typescript
// _shared/autentique-positions.ts
export function gerarPosicoesAssinatura(totalPaginas = 20) {
  const positions = [];
  
  // INITIALS em todas as páginas (exceto a última)
  for (let p = 1; p < totalPaginas; p++) {
    positions.push({
      x: "78.0",   // canto inferior direito
      y: "95.0",
      z: String(p),
      element: "INITIALS",
    });
  }
  
  // SIGNATURE na última página
  positions.push({
    x: "65.0",
    y: "85.0",
    z: String(totalPaginas),
    element: "SIGNATURE",
  });
  
  return positions;
}
```

**Em cada edge function**, substituir:
```js
positions: [{ x: "65.0", y: "85.0", z: "1", element: "SIGNATURE" }]
```
por:
```js
positions: gerarPosicoesAssinatura()
```

Isso garante que o signatário verá campo de rubrica em cada página e assinatura completa na última, sem precisar saber previamente quantas páginas o documento terá.

