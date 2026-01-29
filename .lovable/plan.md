

# Revisao Completa - Fluxo de Recebimento e Processamento de Mensagens via Webhook Evolution

## Resumo Executivo

| Cenario | Status | Implementacao Atual | Problema |
|---------|--------|---------------------|----------|
| Mensagem de texto de associado | **OK** | Processada e vinculada ao associado | Funcionando |
| Mensagem de lead respondendo proposta | **NAO IMPLEMENTADO** | Ignorada (lead nao e buscado) | Sistema so busca associados |
| Mensagem com documento anexado (foto) | **NAO IMPLEMENTADO** | Ignorada (if "sem texto") | Linha 1531-1532 ignora |
| Mensagem de audio do associado | **NAO IMPLEMENTADO** | Ignorada (if "sem texto") | Linha 1531-1532 ignora |
| Anexos baixados e armazenados | **NAO IMPLEMENTADO** | Nenhuma logica de download | Falta implementar |
| Historico de conversas mantido | **PARCIAL** | Apenas mensagens de texto | Media nao e registrada |
| Numeros desconhecidos tratados | **OK** | Responde orientando contato | Funcionando |

---

## Analise Detalhada

### 1. Mensagens de Texto de Associado - FUNCIONANDO

```typescript
// Linha 1529 - Extrai apenas texto
const mensagemTexto = data.message?.conversation || data.message?.extendedTextMessage?.text || "";

// Linha 1531-1532 - PROBLEMA: Ignora qualquer mensagem sem texto
if (!mensagemTexto.trim()) {
  return new Response(JSON.stringify({ ok: true, ignored: "sem texto" }), { headers: corsHeaders });
}
```

**Status:** Mensagens de texto sao vinculadas corretamente ao associado via busca por telefone.

### 2. Mensagem de Lead Respondendo Proposta - NAO IMPLEMENTADO

```typescript
// Linha 1587-1593 - Busca APENAS associados
const { data: associado } = await supabase
  .from("associados")
  .select("id, nome, status")
  .or(`whatsapp.in.(${telefonesBusca.join(",")}),telefone.in.(${telefonesBusca.join(",")})`)
  .eq("status", "ativo")
  .maybeSingle();

// Linha 1595-1604 - Se nao e associado, responde "nao cadastrado"
if (!associado) {
  await sendWhatsAppMessage(..., "Este número não está cadastrado como associado PRATIC...");
  return ...;
}
```

**Gap:** O sistema nao verifica se o telefone pertence a um lead antes de responder que "nao e associado". Leads que respondem propostas comerciais recebem mensagem incorreta.

### 3. Mensagem com Documento/Foto Anexado - NAO IMPLEMENTADO

A Evolution API envia anexos com esta estrutura:

```json
{
  "event": "messages.upsert",
  "data": {
    "key": { "remoteJid": "...", "fromMe": false },
    "message": {
      "imageMessage": {
        "url": "...",
        "mimetype": "image/jpeg",
        "caption": "Foto do documento"
      }
    }
  }
}
```

**Gap:** O codigo atual nao trata `imageMessage`, `documentMessage`, `videoMessage`. A linha 1531-1532 ignora porque `mensagemTexto` esta vazio.

### 4. Mensagem de Audio do Associado - NAO IMPLEMENTADO

A Evolution API envia audios com esta estrutura:

```json
{
  "event": "messages.upsert",
  "data": {
    "message": {
      "audioMessage": {
        "url": "...",
        "mimetype": "audio/ogg; codecs=opus",
        "seconds": 15
      }
    }
  }
}
```

**Gap:** Mesma situacao - audio e ignorado porque `mensagemTexto` esta vazio. O sistema ja possui a edge function `transcrever-audio` pronta mas nao e utilizada no webhook.

---

## Plano de Implementacao

### Fase 1: Processar Diferentes Tipos de Midia

**Modificar:** `supabase/functions/whatsapp-webhook/index.ts`

Adicionar deteccao de tipo de mensagem antes da validacao de texto:

```typescript
// Detectar tipo de mensagem ANTES de validar texto
const messageData = data.message;

// Tipos de mensagem suportados pela Evolution API
const tipoMensagem = {
  texto: messageData?.conversation || messageData?.extendedTextMessage?.text,
  imagem: messageData?.imageMessage,
  documento: messageData?.documentMessage,
  audio: messageData?.audioMessage,
  video: messageData?.videoMessage,
  localizacao: messageData?.locationMessage,
  contato: messageData?.contactMessage,
};

// Determinar tipo principal
let tipoPrincipal: 'texto' | 'imagem' | 'documento' | 'audio' | 'video' | 'localizacao' | 'contato' | 'desconhecido' = 'desconhecido';

if (tipoMensagem.texto) tipoPrincipal = 'texto';
else if (tipoMensagem.audio) tipoPrincipal = 'audio';
else if (tipoMensagem.imagem) tipoPrincipal = 'imagem';
else if (tipoMensagem.documento) tipoPrincipal = 'documento';
else if (tipoMensagem.video) tipoPrincipal = 'video';
else if (tipoMensagem.localizacao) tipoPrincipal = 'localizacao';
else if (tipoMensagem.contato) tipoPrincipal = 'contato';

// Extrair dados conforme tipo
let mensagemTexto = '';
let mediaUrl: string | null = null;
let mediaMimetype: string | null = null;
let mediaFilename: string | null = null;

switch (tipoPrincipal) {
  case 'texto':
    mensagemTexto = tipoMensagem.texto || '';
    break;
  
  case 'audio':
    mediaUrl = tipoMensagem.audio.url;
    mediaMimetype = tipoMensagem.audio.mimetype;
    // Sera transcrito pela funcao transcrever-audio
    break;
  
  case 'imagem':
    mediaUrl = tipoMensagem.imagem.url;
    mediaMimetype = tipoMensagem.imagem.mimetype;
    mensagemTexto = tipoMensagem.imagem.caption || '[Imagem recebida]';
    break;
  
  case 'documento':
    mediaUrl = tipoMensagem.documento.url;
    mediaMimetype = tipoMensagem.documento.mimetype;
    mediaFilename = tipoMensagem.documento.fileName;
    mensagemTexto = tipoMensagem.documento.caption || `[Documento: ${mediaFilename}]`;
    break;
  
  case 'localizacao':
    const lat = tipoMensagem.localizacao.degreesLatitude;
    const lng = tipoMensagem.localizacao.degreesLongitude;
    mensagemTexto = `[Localização compartilhada: ${lat}, ${lng}]`;
    // Processar com reverse_geocode tool
    break;
}

// ATUALIZAR: Nao ignorar se tiver midia mesmo sem texto
if (!mensagemTexto.trim() && !mediaUrl) {
  return new Response(JSON.stringify({ ok: true, ignored: "sem conteudo" }), ...);
}
```

### Fase 2: Download e Armazenamento de Anexos

Criar helper para baixar midia da Evolution API:

```typescript
async function downloadMediaEvolution(
  apiUrl: string, 
  instanceName: string, 
  messageId: string
): Promise<{ success: boolean; base64?: string; mimetype?: string }> {
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  
  try {
    const response = await fetch(
      `${apiUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        method: "POST",
        headers: {
          "apikey": EVOLUTION_API_KEY || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: { key: { id: messageId } },
          convertToMp4: false,
        }),
      }
    );

    if (!response.ok) {
      console.error("[whatsapp-webhook] Erro ao baixar midia:", await response.text());
      return { success: false };
    }

    const result = await response.json();
    return {
      success: true,
      base64: result.base64,
      mimetype: result.mimetype,
    };
  } catch (err) {
    console.error("[whatsapp-webhook] Erro download midia:", err);
    return { success: false };
  }
}

async function storeMediaSupabase(
  supabase: any,
  base64: string,
  mimetype: string,
  telefone: string
): Promise<string | null> {
  try {
    // Converter base64 para Uint8Array
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Determinar extensao
    const ext = mimetype.split('/')[1]?.split(';')[0] || 'bin';
    const fileName = `whatsapp/${telefone}/${Date.now()}.${ext}`;

    // Upload para bucket
    const { error } = await supabase.storage
      .from('sinistros')  // Reusar bucket existente
      .upload(fileName, bytes, {
        contentType: mimetype,
        upsert: false,
      });

    if (error) throw error;

    // Gerar URL publica
    const { data: urlData } = supabase.storage
      .from('sinistros')
      .getPublicUrl(fileName);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.error("[whatsapp-webhook] Erro ao armazenar midia:", err);
    return null;
  }
}
```

### Fase 3: Transcricao de Audio

Integrar a funcao `transcrever-audio` existente:

```typescript
case 'audio': {
  console.log(`[whatsapp-webhook] Audio recebido de ${telefone}, baixando...`);
  
  const messageId = data.key.id;
  const mediaResult = await downloadMediaEvolution(instancia.api_url, instancia.instance_name, messageId);
  
  if (!mediaResult.success || !mediaResult.base64) {
    mensagemTexto = "[Audio nao pode ser processado]";
    break;
  }
  
  // Converter base64 para Blob para enviar ao transcrever-audio
  const binaryStr = atob(mediaResult.base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  
  const audioBlob = new Blob([bytes], { type: mediaResult.mimetype || 'audio/ogg' });
  
  // Chamar transcricao
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.ogg');
    
    const transcricaoResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/transcrever-audio`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: formData,
      }
    );
    
    if (transcricaoResponse.ok) {
      const transcricao = await transcricaoResponse.json();
      mensagemTexto = transcricao.text || "[Audio transcrito sem conteudo]";
      console.log(`[whatsapp-webhook] Audio transcrito: ${mensagemTexto.substring(0, 50)}...`);
    } else {
      mensagemTexto = "[Audio nao pode ser transcrito]";
    }
  } catch (err) {
    console.error("[whatsapp-webhook] Erro na transcricao:", err);
    mensagemTexto = "[Erro ao processar audio]";
  }
  
  break;
}
```

### Fase 4: Vincular Mensagens a Leads

Adicionar busca de lead apos nao encontrar associado:

```typescript
// Apos linha 1593 (associado nao encontrado)
if (!associado) {
  // NOVO: Verificar se e um lead
  const { data: lead } = await supabase
    .from("leads")
    .select("id, nome, vendedor_id, etapa")
    .or(`telefone.in.(${telefonesBusca.join(",")})`)
    .maybeSingle();
  
  if (lead) {
    console.log(`[whatsapp-webhook] Lead encontrado: ${lead.nome} (${lead.id})`);
    
    // Registrar mensagem no historico do lead
    await supabase.from("leads_historico").insert({
      lead_id: lead.id,
      acao: "mensagem_whatsapp",
      descricao: mensagemTexto.substring(0, 500),
      dados: {
        telefone,
        tipo: tipoPrincipal,
        media_url: mediaUrl,
      },
      usuario_id: lead.vendedor_id,
    });
    
    // Atualizar data do ultimo contato
    await supabase.from("leads")
      .update({ data_ultimo_contato: new Date().toISOString() })
      .eq("id", lead.id);
    
    // Salvar na tabela whatsapp_mensagens
    await supabase.from("whatsapp_mensagens").insert({
      instancia_id: instancia.id,
      telefone,
      nome_contato: lead.nome,
      tipo: tipoPrincipal,
      mensagem: mensagemTexto,
      media_url: mediaUrl,
      media_mimetype: mediaMimetype,
      media_filename: mediaFilename,
      referencia_tipo: "lead",
      referencia_id: lead.id,
      direcao: "entrada",
      status: "entregue",
    });
    
    // Responder ao lead
    await sendWhatsAppMessage(
      instancia.api_url,
      instancia.instance_name,
      telefone,
      `Ola ${lead.nome.split(' ')[0]}! Recebemos sua mensagem. Nosso consultor entrara em contato em breve. 🙂`
    );
    
    // Notificar vendedor do lead
    if (lead.vendedor_id) {
      await supabase.from("notificacoes").insert({
        usuario_id: lead.vendedor_id,
        titulo: "📱 Lead respondeu no WhatsApp",
        mensagem: `${lead.nome}: "${mensagemTexto.substring(0, 100)}${mensagemTexto.length > 100 ? '...' : ''}"`,
        tipo: "info",
        dados: { lead_id: lead.id, telefone },
      });
    }
    
    return new Response(JSON.stringify({ ok: true, lead_id: lead.id }), { headers: corsHeaders });
  }
  
  // Numero desconhecido (nem associado nem lead)
  console.log(`[whatsapp-webhook] Numero desconhecido: ${telefone}`);
  await sendWhatsAppMessage(..., "Olá! Este número não está cadastrado...");
  return ...;
}
```

### Fase 5: Salvar Mensagens de Midia no Historico

Atualizar funcao `saveWhatsAppLog`:

```typescript
async function saveWhatsAppLog(
  supabase: any, 
  instanciaId: string, 
  telefone: string, 
  mensagem: string, 
  direcao: string, 
  messageId?: string,
  tipo?: string,
  mediaUrl?: string,
  mediaMimetype?: string,
  mediaFilename?: string,
  referenciaId?: string,
  referenciaTipo?: string
) {
  await supabase.from("whatsapp_mensagens").insert({
    instancia_id: instanciaId,
    telefone,
    tipo: tipo || "text",
    mensagem,
    media_url: mediaUrl || null,
    media_mimetype: mediaMimetype || null,
    media_filename: mediaFilename || null,
    direcao,
    status: direcao === "saida" ? "enviada" : "entregue",
    message_id: messageId || null,
    sent_at: direcao === "saida" ? new Date().toISOString() : null,
    referencia_tipo: referenciaTipo || null,
    referencia_id: referenciaId || null,
  });
}
```

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar processamento de midia, audio, imagem, documento; vincular leads; atualizar saveWhatsAppLog |

---

## Detalhes Tecnicos

### Tipos de Mensagem da Evolution API

| Tipo | Campo | Campos Relevantes |
|------|-------|-------------------|
| Texto | `conversation` ou `extendedTextMessage.text` | `text` |
| Imagem | `imageMessage` | `url`, `mimetype`, `caption` |
| Documento | `documentMessage` | `url`, `mimetype`, `fileName`, `caption` |
| Audio | `audioMessage` | `url`, `mimetype`, `seconds` |
| Video | `videoMessage` | `url`, `mimetype`, `caption` |
| Localizacao | `locationMessage` | `degreesLatitude`, `degreesLongitude`, `name` |
| Contato | `contactMessage` | `displayName`, `vcard` |

### Endpoint para Download de Midia

```
POST /chat/getBase64FromMediaMessage/{instanceName}

Body:
{
  "message": {
    "key": { "id": "MESSAGE_ID" }
  },
  "convertToMp4": false
}

Response:
{
  "base64": "...",
  "mimetype": "audio/ogg"
}
```

---

## Checklist Pos-Implementacao

- [ ] Mensagem de texto de associado processada corretamente
- [ ] Mensagem de texto de lead vinculada ao lead e vendedor notificado
- [ ] Audio do associado transcrito via Whisper e processado pela IA
- [ ] Imagem do associado baixada, armazenada e registrada no historico
- [ ] Documento (PDF) do associado baixado e armazenado
- [ ] Localizacao convertida em endereco via reverse_geocode
- [ ] Historico completo mantido em `whatsapp_mensagens` com midia
- [ ] Historico do lead atualizado em `leads_historico`
- [ ] Numeros desconhecidos respondem orientando contato

---

## Testes Recomendados

### Teste 1: Mensagem de Lead

1. Cadastrar lead com telefone de teste
2. Enviar mensagem de WhatsApp para numero da associacao
3. Verificar:
   - Lead nao recebe "nao cadastrado como associado"
   - Lead recebe resposta de confirmacao
   - `leads_historico` registra a mensagem
   - Vendedor recebe notificacao

### Teste 2: Audio de Associado

1. Enviar audio para numero da associacao
2. Verificar:
   - Audio e baixado da Evolution API
   - Audio e transcrito pelo Whisper
   - Texto transcrito e processado pela IA
   - Resposta enviada normalmente

### Teste 3: Foto de Documento

1. Enviar foto com caption "Foto do RG"
2. Verificar:
   - Imagem baixada e armazenada no bucket
   - `whatsapp_mensagens` registra com `media_url`
   - IA recebe contexto da imagem

### Teste 4: Localizacao

1. Compartilhar localizacao via WhatsApp
2. Verificar:
   - Coordenadas extraidas corretamente
   - Endereco obtido via reverse_geocode
   - IA usa endereco no contexto

