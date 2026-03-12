

# Fix: Detecção de botão URL no auto-split de parâmetros

## Problema
Linha 142 de `whatsapp-send-text/index.ts` verifica `b.type === 'URL'` (chave em inglês, maiúsculo). Porém os botões no banco usam formato interno `{"tipo": "url", "texto": "..."}` (chave em português, minúsculo).

Resultado: o auto-split body/button não detecta o botão e envia todos os params como body → erro 132000 → auto-retry corrige, mas com uma request extra desnecessária.

## Correção

### `whatsapp-send-text/index.ts` (linha 142)
Alterar a detecção para aceitar ambos os formatos:

```typescript
// Antes:
const hasUrlButton = botoes?.some((b: any) => b.type === 'URL' && b.url?.includes('{{'));

// Depois:
const hasUrlButton = botoes?.some((b: any) =>
  (b.type === 'URL' || b.tipo === 'url') &&
  (b.url?.includes('{{'))
);
```

### Resumo
- **1 edge function** editada (1 linha)
- Elimina request extra desnecessária no envio de templates com botão URL

