

# Fix: Template `boas_vindas_associado` rejeitado por já existir na Meta

## Problema

A Meta retorna "Já existe conteúdo em Português (BR) para esse modelo" porque o template `boas_vindas_associado` foi submetido anteriormente (e rejeitado). Mesmo rejeitado, ele permanece registrado na Meta. O sistema sempre usa `POST` (criar novo), mas precisaria primeiro excluir o antigo antes de recriar.

## Solução

Adicionar lógica de **auto-delete + retry** na ação `enviar` da edge function `whatsapp-meta-templates`. Quando a Meta retornar erro de "já existe", o sistema automaticamente:

1. Deleta o template existente na Meta (`DELETE /message_templates?name=...`)
2. Aguarda 2 segundos
3. Reenvia o template (`POST`)

### `supabase/functions/whatsapp-meta-templates/index.ts`

**No bloco de envio individual (linhas 189-206)** — após detectar `!response.ok`, verificar se o erro é de duplicidade e auto-resolver:

```typescript
if (!response.ok) {
  const motivoRejeicao = result.error?.error_user_msg || result.error?.message || "";
  
  // Auto-resolver: template já existe na Meta → deletar e recriar
  const jáExiste = motivoRejeicao.toLowerCase().includes("já existe") 
    || motivoRejeicao.toLowerCase().includes("already exists")
    || (result.error?.code === 2388023);
    
  if (jáExiste) {
    console.log(`[whatsapp-meta-templates] Template '${template.nome}' já existe na Meta, deletando e recriando...`);
    
    // Deletar da Meta
    await fetch(
      `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates?name=${template.nome}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Reenviar
    const retryResponse = await fetch(
      `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates`,
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(metaPayload) }
    );
    const retryResult = await retryResponse.json();
    
    if (retryResponse.ok) {
      // Sucesso no retry → atualizar banco
      // ... atualizar status para PENDING
    } else {
      // Falhou de novo → marcar REJECTED
    }
  }
}
```

Mesma lógica aplicada no bloco `enviar_todos` (linhas 310-317).

### Resumo
- **1 edge function** editada
- Lógica de auto-delete + retry para erro de duplicidade
- Sem alterações no frontend ou banco

