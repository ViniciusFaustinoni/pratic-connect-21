

# Plano de Correção: QR Code WhatsApp Evolution API

## Problema Identificado

A Evolution API retorna o QR code **já com o prefixo completo** `data:image/png;base64,...`, mas o código atual adiciona o prefixo novamente, resultando em uma URL de imagem inválida.

**Resposta da API (log do banco):**
```
qrcode.base64: "data:image/png;base64,iVBORw0KGgo..."
```

**Código atual do frontend:**
```tsx
<img src={`data:image/png;base64,${qrCodeData}`} />
```

**Resultado:** `data:image/png;base64,data:image/png;base64,...` (INVÁLIDO)

---

## Solução

Modificar o componente `WhatsAppStatusCard.tsx` para verificar se o dado já possui o prefixo antes de adicioná-lo.

### Arquivo a Modificar

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/components/whatsapp/WhatsAppStatusCard.tsx` | 226 | Verificar se já tem prefixo `data:image` |

### Código Atual (Linha 226)
```tsx
<img 
  src={`data:image/png;base64,${qrCodeData}`}
  alt="QR Code WhatsApp"
  className="w-64 h-64"
/>
```

### Código Corrigido
```tsx
<img 
  src={qrCodeData.startsWith('data:image') ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
  alt="QR Code WhatsApp"
  className="w-64 h-64"
/>
```

---

## Alternativa (Mais Robusta)

Corrigir na edge function para normalizar a resposta, removendo o prefixo se existir:

### Arquivo
`supabase/functions/whatsapp-qrcode/index.ts`

### Código a Adicionar (função helper)
```typescript
// Normalizar base64 - remover prefixo se existir
function normalizeBase64(data: string | undefined): string | undefined {
  if (!data) return undefined;
  // Se já tem o prefixo data:image, retornar como está
  if (data.startsWith('data:image')) {
    return data;
  }
  // Se não tem, adicionar o prefixo
  return `data:image/png;base64,${data}`;
}
```

E usar no retorno:
```typescript
return new Response(
  JSON.stringify({
    success: true,
    qrcode: normalizeBase64(createData.qrcode?.base64),
    // ...
  }),
);
```

---

## Recomendação

**Opção 1 (frontend)** é mais simples e resolve imediatamente.

**Opção 2 (edge function)** é mais robusta e centraliza a lógica.

Recomendo implementar **ambas** para garantir compatibilidade com diferentes versões da Evolution API.

---

## Resultado Esperado

Após a correção, o QR code será exibido corretamente no modal de conexão WhatsApp.

