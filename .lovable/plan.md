
# Plano de Correcao: Webhook WhatsApp - Formato LID

## Diagnostico do Problema

### O que esta acontecendo

O WhatsApp esta usando um novo formato de identificacao chamado **LID** (Linked ID). Quando uma mensagem chega, o campo `remoteJid` pode vir em dois formatos:

| Formato | Exemplo | Uso |
|---------|---------|-----|
| Tradicional | `5511999999999@s.whatsapp.net` | Telefone valido |
| LID | `228496672596130@lid` | ID interno WhatsApp (NAO e telefone) |

### Logs que comprovam o problema

```
remoteJid: "228496672596130@lid"  <- ID LID (invalido para envio)
sender: "5511953221644@s.whatsapp.net"  <- Telefone real (correto)
```

### Erro atual

```
ERROR: {"status":400,"error":"Bad Request","response":{
  "exists":false,
  "jid":"228496672596130@lid",
  "number":"228496672596130@lid"
}}
```

O sistema esta tentando enviar mensagem para o LID ao inves do telefone real.

---

## Solucao Proposta

### Modificar a extracao do telefone no webhook

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

### Logica atual (linha 847):
```javascript
const telefone = remoteJid.replace("@s.whatsapp.net", "");
```

### Nova logica (priorizar campo `sender`):
```javascript
// 1. Verificar se remoteJid e LID (@lid)
// 2. Se for LID, usar o campo "sender" do payload
// 3. Se nao, usar remoteJid normal

let telefone: string;
const remoteJid = data.key.remoteJid || "";

if (remoteJid.includes("@lid")) {
  // Usar campo sender que contem o telefone real
  const sender = payload.sender || "";
  telefone = sender.replace("@s.whatsapp.net", "");
  console.log(`[whatsapp-webhook] LID detectado, usando sender: ${telefone}`);
} else {
  telefone = remoteJid.replace("@s.whatsapp.net", "");
}
```

---

## Alteracoes Detalhadas

### 1. Extracao do Telefone (linhas 840-848)

**De:**
```javascript
const remoteJid = data.key.remoteJid || "";
if (remoteJid.includes("@g.us")) {
  return new Response(JSON.stringify({ ok: true, ignored: "grupo" }), { headers: corsHeaders });
}

const telefone = remoteJid.replace("@s.whatsapp.net", "");
```

**Para:**
```javascript
const remoteJid = data.key.remoteJid || "";

// Ignorar grupos
if (remoteJid.includes("@g.us")) {
  return new Response(JSON.stringify({ ok: true, ignored: "grupo" }), { headers: corsHeaders });
}

// Extrair telefone - LID vs formato tradicional
let telefone: string;
if (remoteJid.includes("@lid")) {
  // LID: Usar campo "sender" que contem telefone real
  const sender = payload.sender || "";
  telefone = sender.replace("@s.whatsapp.net", "").replace(/\D/g, "");
  
  if (!telefone) {
    console.error("[whatsapp-webhook] LID sem sender valido:", { remoteJid, sender });
    return new Response(JSON.stringify({ ok: true, ignored: "lid_sem_sender" }), { headers: corsHeaders });
  }
  
  console.log(`[whatsapp-webhook] LID detectado, telefone extraido de sender: ${telefone}`);
} else {
  telefone = remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
}
```

### 2. Logs melhorados

Adicionar log no inicio para debug:
```javascript
console.log("[whatsapp-webhook] Dados recebidos:", {
  remoteJid: data.key.remoteJid,
  sender: payload.sender,
  fromMe: data.key.fromMe
});
```

---

## Fluxo Corrigido

```
Mensagem recebida do WhatsApp
         |
         v
+-------------------+
| remoteJid contem  |
|     "@lid"?       |
+-------------------+
    |           |
   SIM         NAO
    |           |
    v           v
Usar campo    Usar remoteJid
"sender"      diretamente
    |           |
    v           v
+-------------------+
| Extrair telefone  |
| limpo (so numeros)|
+-------------------+
         |
         v
Buscar associado e processar
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/whatsapp-webhook/index.ts` | Corrigir extracao de telefone para suportar LID |

---

## Testes Necessarios

Apos a correcao:

1. Enviar mensagem do WhatsApp para o numero conectado
2. Verificar nos logs que o telefone foi extraido corretamente
3. Confirmar que a resposta da IA foi enviada
4. Verificar que a mensagem chegou no WhatsApp

---

## Por que isso aconteceu?

O WhatsApp introduziu o formato LID como parte de uma mudanca de arquitetura. Antigamente, todas as mensagens vinham com `@s.whatsapp.net`. Agora, dependendo do tipo de conexao e da versao do WhatsApp, pode vir como `@lid`.

A Evolution API adiciona o campo `sender` no payload exatamente para este caso - ele sempre contem o telefone no formato correto.
