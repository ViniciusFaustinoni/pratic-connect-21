
# Plano: Corrigir Mapeamento de Status WhatsApp `connecting`

## Problema Identificado

O webhook do WhatsApp está recebendo eventos `CONNECTION_UPDATE` com `state: connecting` e mapeando para `disconnected`, quando deveria:
1. Tratar `connecting` como um estado intermediário (não sobrescrever `open` para `disconnected`)
2. Ou simplesmente ignorar eventos `connecting` para não alterar o status atual

### Evidência
```
17:02:12 - status_check: state = open (correto)
17:02:13 - webhook: state = connecting → salva como disconnected (BUG!)
```

### Impacto
- Mensagens de WhatsApp falham porque o sistema lê `status: disconnected` do banco
- Mesmo com a instância realmente conectada na Evolution API

---

## Alteração Necessária

### Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

**Localização:** Linha ~2118

**Código Atual (Incorreto):**
```typescript
const novoStatus = state === 'open' ? 'open' : 'disconnected';
```

**Código Corrigido:**
```typescript
// Mapear estado para nosso status
// IMPORTANTE: 'connecting' não deve sobrescrever 'open'
let novoStatus: string;
if (state === 'open') {
  novoStatus = 'open';
} else if (state === 'close' || state === 'qrcode') {
  novoStatus = 'disconnected';
} else if (state === 'connecting') {
  // Ignorar eventos 'connecting' - manter status atual
  console.log(`[whatsapp-webhook] Ignorando estado 'connecting' - mantendo status atual`);
  return new Response(
    JSON.stringify({ success: true, message: "Estado connecting ignorado" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
} else {
  // Estado desconhecido - manter como disconnected por segurança
  novoStatus = 'disconnected';
}
```

---

## Alternativa (Mais Simples)

Manter a lógica atual mas adicionar `connecting` como estado válido:

```typescript
// Mapear estado para nosso status
const statusMap: Record<string, string> = {
  'open': 'open',
  'close': 'disconnected',
  'qrcode': 'disconnected',
  'connecting': 'connecting', // Novo: manter como connecting
};

const novoStatus = statusMap[state] || 'disconnected';

// Só atualizar se for um estado definitivo (open ou disconnected)
// Connecting é transitório - pode ignorar ou salvar
if (state === 'connecting') {
  // Opção 1: Ignorar completamente
  console.log(`[whatsapp-webhook] Estado 'connecting' - ignorando atualização`);
  return new Response(
    JSON.stringify({ success: true, message: "Connecting ignorado" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

## Também Atualizar: `whatsapp-send-text`

### Problema Secundário
O envio valida status do banco, mas deveria ter fallback para consultar a API se banco mostrar disconnected.

### Arquivo: `supabase/functions/whatsapp-send-text/index.ts`

**Adicionar verificação em tempo real (opcional mas recomendado):**
```typescript
// Linha 47-58 - Após buscar instância
if (!instancia.status || instancia.status !== 'open') {
  // NOVO: Verificar status real na Evolution API antes de falhar
  console.log(`[whatsapp-send-text] Status no banco: ${instancia.status} - verificando API...`);
  
  const statusResponse = await fetch(
    `${apiUrl}/instance/connectionState/${instancia.instance_name}`,
    {
      method: 'GET',
      headers: { 'apikey': EVOLUTION_API_KEY }
    }
  );
  
  if (statusResponse.ok) {
    const statusData = await statusResponse.json();
    const realStatus = statusData.instance?.state;
    
    if (realStatus === 'open') {
      console.log(`[whatsapp-send-text] API retorna OPEN - prosseguindo com envio`);
      // Atualizar banco com status correto
      await supabase
        .from('whatsapp_instancias')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', instancia.id);
    } else {
      // Realmente desconectado
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "WhatsApp não está conectado. Acesse as configurações para reconectar.",
          status: realStatus
        }),
        { status: 503, headers: corsHeaders }
      );
    }
  }
}
```

---

## Resumo de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/whatsapp-webhook/index.ts` | Ignorar eventos `connecting` para não sobrescrever status `open` |
| `supabase/functions/whatsapp-send-text/index.ts` | (Opcional) Verificar API em tempo real antes de falhar |

---

## Ação Imediata para Marcos Vinicius

Após aplicar a correção:
1. O status no banco será corrigido automaticamente no próximo `status_check`
2. Podemos reenviar a mensagem de boas-vindas manualmente via console ou criar um endpoint de reenvio

---

## Validação Pós-Deploy

1. Verificar que eventos `connecting` são ignorados nos logs
2. Confirmar que status no banco permanece `open` quando conectado
3. Testar envio de mensagem WhatsApp
