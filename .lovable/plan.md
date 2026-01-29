

# Revisao Completa - Fluxo de Envio de Localizacao via Evolution API

## Resumo Executivo

| Cenario | Status | Implementacao Atual | Problema |
|---------|--------|---------------------|----------|
| Prestador precisa da localizacao do veiculo | **NAO IMPLEMENTADO** | Envia texto com link Google Maps | NAO usa sendLocation |
| Associado solicita guincho e informa localizacao | **NAO IMPLEMENTADO** | Envia texto com link Google Maps | NAO usa sendLocation |
| Compartilhamento de posicao do rastreador | **NAO IMPLEMENTADO** | Nenhum | Funcionalidade nao existe |
| Instalador precisa do endereco de instalacao | **NAO IMPLEMENTADO** | Usa wa.me com texto | NAO usa sendLocation |

**Conclusao:** O endpoint `POST /message/sendLocation/{instanceName}` da Evolution API **NAO esta sendo utilizado em nenhum momento** no sistema. Todas as localizacoes sao enviadas como texto contendo links do Google Maps, perdendo os beneficios do pin nativo do WhatsApp.

---

## Analise Detalhada

### 1. Prestador de Assistencia 24h Precisa da Localizacao do Veiculo

**STATUS: NAO IMPLEMENTADO**

**Arquivo:** `src/components/assistencia/EnviarLinkPrestadorButton.tsx`

O componente atual envia apenas texto com link do Google Maps:

```typescript
// Linhas 69-82
const mensagem = `🚨 *CHAMADO DE ASSISTÊNCIA*
...
🗺️ *Ver no Mapa:*
${linkGoogleMaps || 'Link não disponível'}
...`;

// Linha 96-101 - Envia via whatsapp-send-text (apenas texto)
const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
  body: {
    telefone: telefoneFormatado,
    mensagem: mensagem,  // TEXTO com link, nao localizacao nativa
  },
});
```

**Gap:** Deveria usar `sendLocation` para enviar pin interativo + texto com detalhes.

---

### 2. Associado Solicita Guincho e Informa Localizacao

**STATUS: NAO IMPLEMENTADO**

**Arquivo:** `supabase/functions/criar-chamado-assistencia/index.ts`

Ao criar chamado, o sistema envia WhatsApp para a central apenas com texto:

```typescript
// Linhas 351-370
const mensagemCentral = `🚨 *NOVO CHAMADO DE ASSISTÊNCIA*
...
📍 *Local:* ${payload.endereco || enderecoData.endereco}
🗺️ *Ver no Mapa:* ${linkMapa}
...`;

// Linha 373-381 - Usa whatsapp-send-media com tipo 'text' (incorreto)
await supabaseAdmin.functions.invoke('whatsapp-send-media', {
  body: {
    telefone: telefoneCentral.replace(/\D/g, ''),
    tipo: 'text',  // TEXTO, nao localizacao
    mensagem: mensagemCentral,
    ...
  },
});
```

**Gap:** A central recebe apenas texto com link. Deveria receber pin nativo do WhatsApp para facilitar navegacao.

---

### 3. Compartilhamento de Posicao do Rastreador

**STATUS: NAO IMPLEMENTADO**

Nao existe funcionalidade no sistema para compartilhar a posicao do rastreador via WhatsApp com pin nativo. As opcoes atuais sao:

- Ver posicao no mapa interno do app
- Ver link no Google Maps (texto)

**Gap:** Deveria permitir enviar posicao do rastreador como pin nativo do WhatsApp para:
- Associado acompanhar veiculo
- Prestador localizar veiculo
- Central monitorar em tempo real

---

### 4. Instalador Precisa do Endereco de Instalacao

**STATUS: NAO IMPLEMENTADO**

**Arquivo:** `src/components/instalador/InstalacaoCard.tsx`

O componente abre wa.me com mensagem de texto:

```typescript
// Linhas 38-45
const handleWhatsApp = () => {
  if (!telefone) return;
  const numero = telefone.replace(/\D/g, '');
  const mensagem = encodeURIComponent(
    `Olá ${instalacao.associados?.nome}, sou o instalador da PRATIC...`
  );
  window.open(`https://wa.me/55${numero}?text=${mensagem}`, '_blank');
};
```

**Gap:** O instalador nao recebe endereco como pin. Abre apenas Google Maps via link separado.

---

## Edge Function Necessaria: whatsapp-send-location

A Evolution API suporta o endpoint `POST /message/sendLocation/{instanceName}` com o seguinte payload:

```json
{
  "number": "5599999999999",
  "name": "Palácio da Liberdade",
  "address": "Praça da Liberdade, Belo Horizonte, MG 30140-050",
  "latitude": -19.93359,
  "longitude": -43.93851
}
```

**Resposta esperada:**
```json
{
  "key": {
    "remoteJid": "553198296801@s.whatsapp.net",
    "fromMe": true,
    "id": "BAE51B6FF4470AF9"
  },
  "message": {
    "locationMessage": {
      "degreesLatitude": -19.93359,
      "degreesLongitude": -43.93851,
      "name": "Palácio da Liberdade",
      "address": "Praça da Liberdade, Belo Horizonte, MG 30140-050"
    }
  }
}
```

---

## Plano de Implementacao

### Fase 1: Criar Edge Function whatsapp-send-location

**Novo arquivo:** `supabase/functions/whatsapp-send-location/index.ts`

```typescript
interface SendLocationPayload {
  telefone: string;
  latitude: number;
  longitude: number;
  name?: string;        // Nome do local (aparece em negrito)
  address?: string;     // Endereco (aparece abaixo do nome)
  instancia_id?: string;
  referencia_tipo?: string;
  referencia_id?: string;
}

// Handler principal
serve(async (req) => {
  // 1. Validar payload
  // 2. Buscar instancia ativa
  // 3. Verificar status da conexao
  // 4. Formatar telefone (55 + numero)
  // 5. Chamar Evolution API: POST /message/sendLocation/{instanceName}
  // 6. Registrar em whatsapp_mensagens com tipo 'location'
  // 7. Retornar resultado
});
```

**Parametros obrigatorios:**
- `telefone`: Numero do destinatario
- `latitude`: Latitude (float)
- `longitude`: Longitude (float)

**Parametros opcionais:**
- `name`: Nome do local (se nao informado, buscar via reverse geocoding)
- `address`: Endereco formatado (se nao informado, buscar via reverse geocoding)

---

### Fase 2: Integrar no EnviarLinkPrestadorButton

**Modificar:** `src/components/assistencia/EnviarLinkPrestadorButton.tsx`

Adicionar botao "Enviar Pin" que usa a nova edge function:

```typescript
const handleEnviarPinLocation = async () => {
  if (!prestadorTelefone || !lat || !lng) {
    toast.error('Dados insuficientes');
    return;
  }

  setEnviandoEvolution(true);
  
  try {
    // 1. Primeiro enviar o PIN de localizacao
    const { error: locationError } = await supabase.functions.invoke('whatsapp-send-location', {
      body: {
        telefone: prestadorTelefone.replace(/\D/g, ''),
        latitude: lat,
        longitude: lng,
        name: `Chamado #${protocolo}`,
        address: origemEndereco || 'Localização do veículo',
        referencia_tipo: 'chamado_assistencia',
        referencia_id: chamadoId,
      },
    });

    if (locationError) throw locationError;

    // 2. Depois enviar mensagem com detalhes (opcional)
    await supabase.functions.invoke('whatsapp-send-text', {
      body: {
        telefone: prestadorTelefone.replace(/\D/g, ''),
        mensagem: mensagem.replace(/🗺️.*\n/g, ''), // Remove link do Maps
      },
    });

    toast.success('📍 Localização enviada!');
    setOpen(false);
  } catch (err: any) {
    toast.error(`Erro: ${err.message}`);
  } finally {
    setEnviandoEvolution(false);
  }
};
```

---

### Fase 3: Integrar no Chamado de Assistencia

**Modificar:** `supabase/functions/criar-chamado-assistencia/index.ts`

Apos criar chamado, enviar localizacao como pin + mensagem de texto:

```typescript
// Apos inserir chamado (linha ~386)
if (telefoneCentral) {
  // 1. Enviar PIN de localização nativo
  try {
    await supabaseAdmin.functions.invoke('whatsapp-send-location', {
      body: {
        telefone: telefoneCentral.replace(/\D/g, ''),
        latitude: payload.latitude,
        longitude: payload.longitude,
        name: `Chamado ${protocolo}`,
        address: payload.endereco || enderecoData.endereco,
        referencia_tipo: 'chamado_assistencia',
        referencia_id: chamado.id,
      },
    });
  } catch (locErr) {
    console.error('[criar-chamado] Erro ao enviar pin:', locErr);
  }

  // 2. Enviar mensagem de texto com detalhes
  const mensagemCentral = `🚨 *NOVO CHAMADO*
📋 Protocolo: ${protocolo}
🔧 Tipo: ${TIPO_LABELS[payload.tipo_assistencia]}
👤 ${associado.nome}
📱 ${associado.whatsapp || associado.telefone}
🚗 ${veiculo.placa} - ${veiculo.marca} ${veiculo.modelo}`;

  await supabaseAdmin.functions.invoke('whatsapp-send-text', {
    body: {
      telefone: telefoneCentral.replace(/\D/g, ''),
      mensagem: mensagemCentral,
    },
  });
}
```

---

### Fase 4: Adicionar Tool de Localizacao na IA (WhatsApp Webhook)

**Modificar:** `supabase/functions/whatsapp-webhook/index.ts`

Adicionar nova tool para IA enviar localizacao quando solicitado:

```typescript
// Na lista de tools (apos enviar_boleto_pdf)
{
  type: "function",
  function: {
    name: "enviar_localizacao_veiculo",
    description: "Envia a localização atual do veículo via pin do WhatsApp. Use quando o associado pedir para ver onde está o carro.",
    parameters: {
      type: "object",
      properties: {
        veiculo_id: { type: "string", description: "ID do veículo (opcional, usa o primeiro se não informado)" },
      },
      required: [],
    },
  },
},

// No switch de execucao de tools
case "enviar_localizacao_veiculo": {
  // Buscar veiculo do associado
  const { data: veiculos } = await supabase
    .from("veiculos")
    .select("id, placa")
    .eq("associado_id", associadoId)
    .eq("status", "ativo")
    .limit(1);

  const veiculo = veiculos?.[0];
  if (!veiculo) {
    return JSON.stringify({ success: false, message: "Nenhum veículo ativo encontrado" });
  }

  // Buscar posicao do rastreador
  const { data: rastreador } = await supabase
    .from("rastreadores")
    .select("ultima_posicao_lat, ultima_posicao_lng")
    .eq("veiculo_id", veiculo.id)
    .eq("status", "instalado")
    .single();

  if (!rastreador?.ultima_posicao_lat || !rastreador?.ultima_posicao_lng) {
    return JSON.stringify({ success: false, message: "Posição do veículo não disponível" });
  }

  // Enviar pin via whatsapp-send-location
  await supabase.functions.invoke('whatsapp-send-location', {
    body: {
      telefone: telefone,
      latitude: rastreador.ultima_posicao_lat,
      longitude: rastreador.ultima_posicao_lng,
      name: `Veículo ${veiculo.placa}`,
      address: "Última posição conhecida",
    },
  });

  return JSON.stringify({ 
    success: true, 
    message: "Pronto! A localização do seu veículo foi enviada. Verifique o mapa na conversa! 📍" 
  });
}
```

---

### Fase 5: Integrar no App do Instalador

**Modificar:** `src/components/instalador/InstalacaoCard.tsx`

Adicionar botao para enviar endereco de instalacao via Evolution:

```typescript
const [enviandoLocalizacao, setEnviandoLocalizacao] = useState(false);

const handleEnviarLocalizacao = async () => {
  if (!telefone || !instalacao.latitude || !instalacao.longitude) {
    toast.error('Dados insuficientes');
    return;
  }

  setEnviandoLocalizacao(true);
  
  try {
    const { error } = await supabase.functions.invoke('whatsapp-send-location', {
      body: {
        telefone: telefone.replace(/\D/g, ''),
        latitude: instalacao.latitude,
        longitude: instalacao.longitude,
        name: `Instalação - ${instalacao.associados?.nome}`,
        address: endereco,
      },
    });

    if (error) throw error;
    toast.success('Localização enviada ao cliente!');
  } catch (err: any) {
    toast.error(`Erro: ${err.message}`);
  } finally {
    setEnviandoLocalizacao(false);
  }
};
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/whatsapp-send-location/index.ts` | Nova edge function para envio de localizacao |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/config.toml` | Adicionar configuracao da nova function |
| `src/components/assistencia/EnviarLinkPrestadorButton.tsx` | Adicionar envio de pin nativo |
| `supabase/functions/criar-chamado-assistencia/index.ts` | Enviar pin ao criar chamado |
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar tool `enviar_localizacao_veiculo` |
| `src/components/instalador/InstalacaoCard.tsx` | Adicionar botao para enviar localizacao |

---

## Detalhes Tecnicos

### Payload Evolution API sendLocation

```json
{
  "number": "5599999999999",
  "name": "Nome do Local (negrito)",
  "address": "Endereco formatado",
  "latitude": -23.550520,
  "longitude": -46.633308
}
```

### Resposta Esperada

```json
{
  "key": {
    "remoteJid": "5599999999999@s.whatsapp.net",
    "fromMe": true,
    "id": "ABCD1234"
  },
  "message": {
    "locationMessage": {
      "degreesLatitude": -23.550520,
      "degreesLongitude": -46.633308,
      "name": "Nome do Local",
      "address": "Endereco formatado"
    }
  }
}
```

### Validacoes Necessarias

| Campo | Validacao |
|-------|-----------|
| `latitude` | Deve ser numero entre -90 e 90 |
| `longitude` | Deve ser numero entre -180 e 180 |
| `name` | Maximo 200 caracteres |
| `address` | Maximo 500 caracteres |

---

## Checklist Pos-Implementacao

- [ ] Edge function `whatsapp-send-location` criada e deployada
- [ ] Latitude e longitude validados corretamente
- [ ] Name (nome do local) preenchido automaticamente via geocoding quando nao informado
- [ ] Address (endereco) formatado corretamente
- [ ] Pin de localizacao aparece corretamente no WhatsApp
- [ ] Mensagens de texto complementares enviadas apos o pin
- [ ] IA pode enviar localizacao do rastreador via tool
- [ ] Prestador de assistencia recebe pin + detalhes
- [ ] Central de assistencia recebe pin + dados do chamado
- [ ] Instalador pode enviar localizacao ao cliente
- [ ] Logs registrados em `whatsapp_mensagens` com tipo `location`

---

## Teste Recomendado: Envio de Localizacao

### Pre-requisitos

1. WhatsApp conectado via QR Code
2. Numero de teste cadastrado
3. Chamado de assistencia com coordenadas

### Passos do Teste

1. Acessar Assistencia > Chamados
2. Abrir chamado com prestador atribuido
3. Clicar em "Enviar Localizacao" (apos implementacao)
4. Verificar no WhatsApp do destinatario:
   - Pin de localizacao recebido
   - Nome do local visivel
   - Endereco formatado
   - Botao "Ver no Maps" funcional
5. Tocar no pin e confirmar que abre navegacao

### Resultado Esperado

- Pin de localizacao nativo do WhatsApp
- Nome: "Chamado #ASS-XXXXXXXX-XXXX"
- Endereco: Endereco completo formatado
- Clique no pin abre Google Maps ou Waze
- Registro em `whatsapp_mensagens` com tipo `location`

