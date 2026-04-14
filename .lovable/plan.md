

## Plano: Vinicius responde pela Evolution, associado recebe numero Meta

### Problema
O agente Vinicius envia respostas via Meta API (porque `whatsapp_meta_config.ativo = true` e nao ha `force_provider`). O correto e:
- **Vinicius (agente vendedor)** → responde pela **Evolution**
- **Numero de atendimento para associados** → numero conectado na **Meta API** (suporte)

### Alteracoes em `supabase/functions/agente-consultor-ia/index.ts`

**1. Forcar envio via Evolution**

Na funcao `enviarWhatsApp` (linha 1271), adicionar `force_provider: "evolution"`:
```typescript
body: JSON.stringify({ telefone, mensagem, allow_text: true, force_provider: "evolution" }),
```

**2. Numero de atendimento = numero Meta API**

Alterar a busca do numero de atendimento (linhas 158-200). Em vez de buscar `whatsapp_instancias.telefone` (Evolution), buscar o `phone_number_id` da `whatsapp_meta_config` e fazer lookup via Graph API para obter o numero real, ou buscar diretamente na tabela se houver campo. Como nao ha `display_phone_number` na tabela, faremos lookup via Graph API:

```typescript
// Buscar numero de atendimento via Meta API (phone_number_id → display_phone_number)
const { data: metaCfg } = await supabase
  .from("whatsapp_meta_config")
  .select("phone_number_id, access_token")
  .eq("ativo", true)
  .maybeSingle();

if (metaCfg?.phone_number_id && metaCfg?.access_token) {
  const resp = await fetch(
    `https://graph.facebook.com/v21.0/${metaCfg.phone_number_id}?fields=display_phone_number`,
    { headers: { Authorization: `Bearer ${metaCfg.access_token}` } }
  );
  const data = await resp.json();
  if (data?.display_phone_number) {
    numeroAtendimento = data.display_phone_number;
  }
}
```

Fallback mantido: se nao conseguir, usa "nosso numero principal de atendimento".

### Resumo
- `enviarWhatsApp` → `force_provider: "evolution"` (Vinicius responde pela Evolution)
- Numero de atendimento para associados → busca via Meta Graph API (numero do suporte)

### Arquivo editado
- `supabase/functions/agente-consultor-ia/index.ts`

