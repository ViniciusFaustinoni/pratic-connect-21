
# Revisao Completa - Fluxo de Envio de Contatos via Evolution API

## Resumo Executivo

| Cenario | Status | Implementacao Atual | Problema |
|---------|--------|---------------------|----------|
| Associado solicita contato do guincho/prestador | **NAO IMPLEMENTADO** | Nenhum | Contato nao e enviado como cartao VCard |
| Passar contato da central de atendimento | **NAO IMPLEMENTADO** | Nenhum | Central informada apenas como texto |
| IA envia contato do prestador | **NAO IMPLEMENTADO** | Nenhum | Tool nao existe |
| Tracking exibe contato do prestador | **PARCIAL** | Mostra nome/telefone | Nao permite salvar diretamente |

**Conclusao:** O endpoint `POST /message/sendContact/{instanceName}` da Evolution API **NAO esta sendo utilizado**. Contatos sao compartilhados apenas como texto, perdendo o beneficio de permitir que o destinatario salve o contato diretamente no celular.

---

## Formato do Endpoint Evolution API

Baseado na documentacao oficial da Evolution API:

### Request

```
POST /message/sendContact/{instanceName}
```

### Payload

```json
{
  "number": "5599999999999",
  "contact": [
    {
      "fullName": "Guilherme Gomes",
      "wuid": "5531982960001",
      "phoneNumber": "+55 31 98296-0001",
      "organization": "Guincho 24h",
      "email": "contato@guincho.com.br",
      "url": ""
    }
  ]
}
```

### Campos

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `fullName` | string | Sim | Nome completo do contato (aparece no cartao) |
| `wuid` | string | Sim | WhatsApp User ID (numero no formato 5511999999999) |
| `phoneNumber` | string | Nao | Numero formatado para exibicao (+55 11 99999-9999) |
| `organization` | string | Nao | Empresa/organizacao |
| `email` | string | Nao | Email do contato |
| `url` | string | Nao | Site/URL do contato |

### Resposta Esperada

```json
{
  "key": {
    "remoteJid": "5531982960001@s.whatsapp.net",
    "fromMe": true,
    "id": "BAE58DA6CBC941BC"
  },
  "message": {
    "contactMessage": {
      "displayName": "Guilherme Gomes",
      "vcard": "BEGIN:VCARD\nVERSION:3.0\nN:Guilherme Gomes\nFN:Guilherme Gomes\nORG:Guincho 24h;\nEMAIL:contato@guincho.com.br\nTEL;waid=5531982960001:+55 31 98296-0001\nEND:VCARD"
    }
  }
}
```

---

## Gaps Identificados

### Gap 1: Associado Solicita Contato do Prestador

Quando um chamado de assistencia e criado e um prestador e atribuido, o associado deveria poder receber o contato do prestador como cartao VCard para salvar diretamente no celular.

**Fluxo atual:** Apenas texto com nome e telefone.
**Fluxo ideal:** Enviar cartao VCard que permite "Adicionar aos Contatos".

### Gap 2: Central de Atendimento como Contato

Ao criar chamados ou em situacoes de emergencia, o sistema deveria enviar o contato da central (0800 ou numero fixo) como cartao salvavel.

**Fluxo atual:** Apenas texto com numero.
**Fluxo ideal:** Cartao VCard da "Central PRATICCAR 24h".

### Gap 3: IA Nao Pode Enviar Contatos

A IA no WhatsApp Webhook nao possui tool para enviar contatos quando o associado pergunta "qual o telefone do guincho?" ou "como falo com a central?".

### Gap 4: Tracking Publico Nao Envia Contato

A pagina `TrackingAssistencia.tsx` exibe nome e telefone do prestador, mas nao oferece opcao de salvar como contato via WhatsApp.

---

## Plano de Implementacao

### Fase 1: Criar Edge Function whatsapp-send-contact

**Novo arquivo:** `supabase/functions/whatsapp-send-contact/index.ts`

```typescript
interface SendContactPayload {
  telefone: string;              // Destinatario
  contato: {
    fullName: string;            // Nome completo (obrigatorio)
    wuid?: string;               // WhatsApp ID (se nao informado, usa phoneNumber)
    phoneNumber: string;         // Telefone formatado
    organization?: string;       // Empresa
    email?: string;              // Email
  };
  instancia_id?: string;
  referencia_tipo?: string;
  referencia_id?: string;
}

serve(async (req) => {
  // 1. Validar payload
  // 2. Buscar instancia ativa
  // 3. Verificar status da conexao
  // 4. Formatar wuid (remover caracteres, garantir formato 5599999999999)
  // 5. Chamar Evolution API: POST /message/sendContact/{instanceName}
  // 6. Registrar em whatsapp_mensagens com tipo 'contact'
  // 7. Retornar resultado
});
```

**Validacoes:**
- `fullName`: Obrigatorio, max 200 caracteres
- `phoneNumber`: Obrigatorio, sera convertido para wuid se nao informado
- `wuid`: Formato 55 + DDD + numero (sem caracteres especiais)

---

### Fase 2: Adicionar Tool na IA (WhatsApp Webhook)

**Modificar:** `supabase/functions/whatsapp-webhook/index.ts`

Adicionar nova tool para IA enviar contatos:

```typescript
// Na lista de tools
{
  type: "function",
  function: {
    name: "enviar_contato_central",
    description: "Envia o cartão de contato da Central de Atendimento PRATICCAR. Use quando o associado perguntar o telefone da central ou como entrar em contato.",
    parameters: { type: "object", properties: {}, required: [] },
  },
},
{
  type: "function",
  function: {
    name: "enviar_contato_prestador",
    description: "Envia o cartão de contato do prestador de serviço (guincho, chaveiro, etc.) do chamado de assistência ativo. Use quando o associado quiser o contato do guincho/prestador.",
    parameters: { type: "object", properties: {}, required: [] },
  },
},
```

**Implementacao das tools:**

```typescript
case "enviar_contato_central": {
  // Buscar telefone da central nas configuracoes
  const { data: config } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "assistencia_telefone_central")
    .maybeSingle();

  const telefoneCentral = config?.valor || "08001234567";
  const wuid = telefoneCentral.replace(/\D/g, '');

  // Enviar contato
  await supabase.functions.invoke('whatsapp-send-contact', {
    body: {
      telefone: telefone,
      contato: {
        fullName: "Central PRATICCAR 24h",
        wuid: wuid.startsWith('55') ? wuid : `55${wuid}`,
        phoneNumber: telefoneCentral,
        organization: "PRATICCAR Proteção Veicular",
      },
    },
  });

  return JSON.stringify({
    success: true,
    message: "Pronto! O cartão de contato da Central foi enviado. Você pode salvá-lo diretamente no seu celular! 📇"
  });
}

case "enviar_contato_prestador": {
  // Buscar chamado ativo com prestador
  const { data: chamados } = await supabase
    .from("chamados_assistencia")
    .select("id, protocolo, prestador_nome, prestador_telefone, tipo_servico")
    .eq("associado_id", associadoId)
    .in("status", ["aguardando_prestador", "prestador_despachado", "prestador_a_caminho", "em_atendimento"])
    .order("created_at", { ascending: false })
    .limit(1);

  const chamado = chamados?.[0];

  if (!chamado) {
    return JSON.stringify({
      success: false,
      message: "Você não tem chamados de assistência ativos no momento."
    });
  }

  if (!chamado.prestador_nome || !chamado.prestador_telefone) {
    return JSON.stringify({
      success: false,
      message: "O prestador ainda não foi atribuído ao seu chamado. Aguarde alguns minutos."
    });
  }

  const wuid = chamado.prestador_telefone.replace(/\D/g, '');

  await supabase.functions.invoke('whatsapp-send-contact', {
    body: {
      telefone: telefone,
      contato: {
        fullName: chamado.prestador_nome,
        wuid: wuid.startsWith('55') ? wuid : `55${wuid}`,
        phoneNumber: chamado.prestador_telefone,
        organization: "Prestador PRATICCAR",
      },
      referencia_tipo: "chamado_assistencia",
      referencia_id: chamado.id,
    },
  });

  return JSON.stringify({
    success: true,
    message: `Pronto! O cartão de contato do ${chamado.prestador_nome} foi enviado. Você pode salvá-lo e ligar diretamente! 📇`
  });
}
```

---

### Fase 3: Enviar Contato do Prestador ao Associado Automaticamente

**Modificar:** `supabase/functions/criar-chamado-assistencia/index.ts` (ou criar trigger)

Quando um prestador for atribuido ao chamado, enviar automaticamente seu contato:

```typescript
// Quando prestador for atribuido (evento de update do chamado)
if (prestadorNome && prestadorTelefone && associadoWhatsApp) {
  // Enviar texto informando
  await supabase.functions.invoke('whatsapp-send-text', {
    body: {
      telefone: associadoWhatsApp.replace(/\D/g, ''),
      mensagem: `✅ *Prestador a Caminho!*\n\n${prestadorNome} foi acionado e está a caminho do local.\n\nEstamos enviando o contato dele para você.`,
    },
  });

  // Enviar cartao de contato
  await supabase.functions.invoke('whatsapp-send-contact', {
    body: {
      telefone: associadoWhatsApp.replace(/\D/g, ''),
      contato: {
        fullName: prestadorNome,
        phoneNumber: prestadorTelefone,
        organization: "Prestador PRATICCAR",
      },
      referencia_tipo: "chamado_assistencia",
      referencia_id: chamadoId,
    },
  });
}
```

---

### Fase 4: Adicionar Botao no EnviarLinkPrestadorButton

**Modificar:** `src/components/assistencia/EnviarLinkPrestadorButton.tsx`

Adicionar opcao para enviar contato do prestador como VCard:

```typescript
// Novo botao para enviar contato
const handleEnviarContato = async () => {
  if (!prestadorNome || !prestadorTelefone) {
    toast.error('Dados do prestador incompletos');
    return;
  }

  setEnviandoContato(true);
  
  try {
    const { error } = await supabase.functions.invoke('whatsapp-send-contact', {
      body: {
        telefone: associadoTelefone.replace(/\D/g, ''),
        contato: {
          fullName: prestadorNome,
          phoneNumber: prestadorTelefone,
          organization: "Prestador PRATICCAR",
        },
        referencia_tipo: "chamado_assistencia",
        referencia_id: chamadoId,
      },
    });

    if (error) throw error;
    toast.success('📇 Contato do prestador enviado!');
  } catch (err: any) {
    toast.error(`Erro: ${err.message}`);
  } finally {
    setEnviandoContato(false);
  }
};
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/whatsapp-send-contact/index.ts` | Edge function para envio de contatos VCard |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/config.toml` | Adicionar configuracao da nova function |
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar tools `enviar_contato_central` e `enviar_contato_prestador` |
| `src/components/assistencia/EnviarLinkPrestadorButton.tsx` | Adicionar botao "Enviar Contato" |

---

## Detalhes Tecnicos

### Formatacao do wuid

O campo `wuid` (WhatsApp User ID) deve seguir o formato:
- Apenas numeros
- Prefixo 55 (Brasil)
- DDD + numero

```typescript
function formatarWuid(telefone: string): string {
  let limpo = telefone.replace(/\D/g, '');
  if (!limpo.startsWith('55')) {
    limpo = '55' + limpo;
  }
  return limpo;
}
```

### Formatacao do phoneNumber

O campo `phoneNumber` e para exibicao no cartao:

```typescript
function formatarPhoneNumber(telefone: string): string {
  const limpo = telefone.replace(/\D/g, '');
  if (limpo.length === 11) {
    return `+55 ${limpo.slice(0, 2)} ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  return telefone;
}
```

---

## Checklist Pos-Implementacao

- [ ] Edge function `whatsapp-send-contact` criada e deployada
- [ ] `fullName` preenchido corretamente em todos os fluxos
- [ ] `wuid` no formato correto (55 + DDD + numero, sem caracteres especiais)
- [ ] `phoneNumber` formatado para exibicao legivel
- [ ] `organization` preenchido quando relevante (Central, Prestador)
- [ ] Contato pode ser salvo diretamente pelo destinatario
- [ ] IA pode enviar contato da central quando solicitado
- [ ] IA pode enviar contato do prestador quando solicitado
- [ ] Botao "Enviar Contato" funciona no painel de assistencia
- [ ] Logs registrados em `whatsapp_mensagens` com tipo `contact`

---

## Teste Recomendado: Envio de Contato

### Pre-requisitos

1. WhatsApp conectado via QR Code
2. Chamado de assistencia com prestador atribuido
3. Numero de teste cadastrado

### Passos do Teste

1. Acessar Assistencia > Chamados
2. Abrir chamado com prestador atribuido
3. Clicar em "Enviar Contato"
4. Verificar no WhatsApp do destinatario:
   - Cartao de contato recebido
   - Nome do prestador visivel
   - Telefone formatado
   - Botao "Adicionar aos Contatos" funcional
5. Clicar em adicionar e confirmar que salva no celular

### Resultado Esperado

- Cartao VCard nativo do WhatsApp
- Nome: Nome do prestador
- Telefone: Numero formatado
- Organizacao: "Prestador PRATICCAR"
- Botao "Adicionar" funciona corretamente
- Registro em `whatsapp_mensagens` com tipo `contact`

---

## Nota sobre Limite de Edge Functions

O projeto pode ter atingido o limite de Edge Functions do Supabase. Se o deploy falhar, sera necessario:
1. Fazer upgrade do plano Supabase, OU
2. Remover uma edge function nao utilizada, OU
3. Consolidar funcionalidades em edge functions existentes

A funcao `whatsapp-send-contact` pode ser adicionada como handler adicional dentro de uma edge function existente (por exemplo, dentro do `whatsapp-webhook` como funcao interna) se necessario.
