

# Revisao Completa - Fluxo de Envio de Mensagens de Texto via Evolution API

## Resumo Executivo

| Cenario | Status | Edge Function | Observacoes |
|---------|--------|---------------|-------------|
| IA interagindo com Associado | **IMPLEMENTADO** | `whatsapp-webhook` | Usa funcao interna `sendWhatsAppMessage()` |
| Notificacao automatica de status de cadastro | **PARCIAL** | `notificar-cliente` | Usa `whatsapp-send-media` para texto (incorreto) |
| Atendente Assistencia 24h responde chamado | **NAO IMPLEMENTADO** | Nenhum | Apenas abre link `wa.me` no navegador |
| Lembrete de boleto proximo do vencimento | **NAO IMPLEMENTADO** | `enviar-lembretes-vencimento` | Apenas registra na tabela, NAO envia |
| Analista solicita documentos ao associado | **NAO IMPLEMENTADO** | Nenhum | Apenas altera status no banco |

---

## Analise Detalhada

### 1. IA Interagindo com Associado via WhatsApp

**STATUS: IMPLEMENTADO CORRETAMENTE**

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts` (linhas 569-592)

O webhook implementa uma funcao interna que chama `POST /message/sendText/{instanceName}`:

```typescript
async function sendWhatsAppMessage(apiUrl: string, instanceName: string, telefone: string, texto: string) {
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  
  const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
    },
    body: JSON.stringify({
      number: telefone,
      text: texto,
    }),
  });
}
```

**Locais onde e usada:**
- Linha 785: Resposta de confirmacao de agendamento
- Linha 810: Fluxo de reagendamento
- Linha 1030: Associado nao encontrado
- Linha 1094: Resposta da IA ao associado

**Verificacao do numero:** Telefone e formatado sem caracteres especiais (linha 986-993)

**Problema identificado:**
- A funcao `sendWhatsAppMessage` NAO verifica se a instancia esta conectada antes de enviar
- NAO ha delay configurado entre mensagens
- Erros sao logados mas nao ha retry

---

### 2. Notificacao Automatica de Status de Cadastro

**STATUS: PARCIALMENTE IMPLEMENTADO**

**Arquivo:** `supabase/functions/notificar-cliente/index.ts`

O sistema chama `whatsapp-send-media` para enviar mensagens de texto, o que e tecnicamente incorreto:

```typescript
// Linha 159-167
await supabase.functions.invoke('whatsapp-send-media', {
  body: {
    telefone: telefone.replace(/\D/g, ''),
    tipo: 'text',
    mensagem: whatsappMsg,
    referencia_tipo: 'notificacao_cliente',
    referencia_id: associado_id,
  },
});
```

**Problema:** O `whatsapp-send-media` espera `media_type`, nao `tipo`, e chama `/message/sendMedia`, nao `/message/sendText`.

**Templates implementados:**
- `vistoria_aprovada`
- `vistoria_reprovada`
- `vistoria_nova_tentativa`
- `instalacao_agendada`
- `instalacao_concluida`
- `cobertura_total_ativada`

---

### 3. Atendente Assistencia 24h Responde Chamado

**STATUS: NAO IMPLEMENTADO VIA EVOLUTION API**

**Arquivo:** `src/components/assistencia/EnviarLinkPrestadorButton.tsx`

O componente abre o WhatsApp Web no navegador, NAO usa a Evolution API:

```typescript
// Linha 82-94
const handleEnviarWhatsApp = () => {
  const telefoneFormatado = prestadorTelefone.replace(/\D/g, '');
  const mensagemCodificada = encodeURIComponent(mensagem);
  
  // Abre wa.me - NÃO usa Evolution API!
  window.open(`https://wa.me/55${telefoneFormatado}?text=${mensagemCodificada}`, '_blank');
};
```

**Gaps:**
- Mensagem nao e registrada no banco
- Nao ha integracao com Evolution API
- Nao ha rastreabilidade do envio
- Atendente precisa ter WhatsApp Web aberto

---

### 4. Lembrete de Boleto Proximo do Vencimento

**STATUS: NAO IMPLEMENTADO - APENAS REGISTRA**

**Arquivo:** `supabase/functions/enviar-lembretes-vencimento/index.ts`

A funcao apenas cria registro na tabela `whatsapp_mensagens` com status "pendente", mas NAO chama a Evolution API:

```typescript
// Linha 169-179
const telefone = associado.whatsapp || associado.telefone;
if (telefone) {
  await supabase.from('whatsapp_mensagens').insert({
    associado_id: associado.id,
    telefone: telefone.replace(/\D/g, ''),
    mensagem,
    tipo: 'lembrete_vencimento',
    status: 'pendente',  // <- FICA PENDENTE FOREVER!
  });
}
```

**Problema critico:** Mensagens nunca sao enviadas, ficam "pendentes" para sempre.

---

### 5. Analista Solicita Documentos ao Associado

**STATUS: NAO IMPLEMENTADO VIA WHATSAPP**

**Arquivo:** `src/hooks/usePropostasPendentes.ts` (linhas 1572-1641)

Quando o analista solicita documentos:
1. Cria registros na tabela `documentos_solicitados`
2. Atualiza status do associado para `documentacao_pendente`
3. Registra no historico

**NAO ha envio de WhatsApp!** O toast diz "O cliente sera notificado no link de acompanhamento", mas nenhuma mensagem e enviada.

---

## Edge Function whatsapp-send-text - Analise

**Arquivo:** `supabase/functions/whatsapp-send-text/index.ts`

### Pontos Positivos

1. **Verificacao de conexao:** Linhas 47-58 verificam se `instancia.status === 'open'`
2. **Formatacao de telefone:** Linha 69 remove caracteres especiais
3. **Registro de mensagem:** Linhas 94-103 salvam na tabela `whatsapp_mensagens`
4. **Tratamento de erros:** Linhas 86-91 e 114-119

### Problemas Identificados

1. **Sem prefixo 55:** Linha 69 apenas limpa caracteres, NAO adiciona prefixo Brasil
2. **Sem delay:** Nenhum delay entre mensagens, risco de bloqueio
3. **Sem retry:** Erros sao logados mas nao ha retentativa

---

## Plano de Implementacao

### Fase 1: Corrigir Formatacao de Telefone

**Modificar:** `supabase/functions/whatsapp-send-text/index.ts`

Adicionar prefixo 55 quando necessario:

```typescript
// Formatar telefone (remover caracteres especiais E garantir prefixo 55)
let telefoneFormatado = telefone.replace(/\D/g, "");
if (!telefoneFormatado.startsWith("55")) {
  telefoneFormatado = "55" + telefoneFormatado;
}
```

### Fase 2: Corrigir notificar-cliente

**Modificar:** `supabase/functions/notificar-cliente/index.ts`

Trocar de `whatsapp-send-media` para `whatsapp-send-text`:

```typescript
await supabase.functions.invoke('whatsapp-send-text', {
  body: {
    telefone: telefone.replace(/\D/g, ''),
    mensagem: whatsappMsg,
  },
});
```

### Fase 3: Implementar Envio de Lembretes de Vencimento

**Modificar:** `supabase/functions/enviar-lembretes-vencimento/index.ts`

Adicionar chamada real para Evolution API:

```typescript
const telefone = associado.whatsapp || associado.telefone;
if (telefone) {
  try {
    // NOVO: Enviar via Evolution API
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('whatsapp-send-text', {
      body: {
        telefone: telefone.replace(/\D/g, ''),
        mensagem,
      },
    });
    
    if (sendError) throw sendError;
    
    // Registrar mensagem como enviada
    await supabase.from('whatsapp_mensagens').insert({
      associado_id: associado.id,
      telefone: telefone.replace(/\D/g, ''),
      mensagem,
      tipo: 'lembrete_vencimento',
      status: 'enviada',
      message_id: sendResult?.message_id,
    });
  } catch (whatsError) {
    console.error(`[enviar-lembretes] Erro WhatsApp:`, whatsError);
    // Registrar como falha
    await supabase.from('whatsapp_mensagens').insert({
      telefone: telefone.replace(/\D/g, ''),
      mensagem,
      tipo: 'lembrete_vencimento',
      status: 'erro',
      erro_mensagem: whatsError.message,
    });
  }
}
```

### Fase 4: Implementar Notificacao de Documentos Solicitados

**Modificar:** `src/hooks/usePropostasPendentes.ts`

Adicionar chamada para WhatsApp quando documentos sao solicitados:

```typescript
// No hook useSolicitarDocumentos, após criar registros
// Chamar edge function para notificar via WhatsApp
await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'documentos_solicitados',
    associado_id: associadoId,
    dados: {
      documentos: documentos.join(', '),
      observacoes,
    },
  },
});
```

E adicionar template em `notificar-cliente`:

```typescript
documentos_solicitados: {
  titulo: '📄 Documentos Pendentes',
  mensagem: 'Olá {nome}! Precisamos de alguns documentos para dar continuidade ao seu cadastro: {documentos}. Acesse o link de acompanhamento para enviar.',
  emailTemplate: 'generico',
},
```

### Fase 5: Integrar Assistencia 24h com Evolution API

**Modificar:** `src/components/assistencia/EnviarLinkPrestadorButton.tsx`

Adicionar opcao de enviar via Evolution API alem de wa.me:

```typescript
const handleEnviarViaEvolution = async () => {
  try {
    const { error } = await supabase.functions.invoke('whatsapp-send-text', {
      body: {
        telefone: `55${prestadorTelefone.replace(/\D/g, '')}`,
        mensagem,
      },
    });
    
    if (error) throw error;
    toast.success('Mensagem enviada com sucesso!');
    setOpen(false);
  } catch (err: any) {
    toast.error(`Erro ao enviar: ${err.message}`);
  }
};
```

### Fase 6: Adicionar Delay entre Mensagens (Anti-Bloqueio)

**Modificar:** `supabase/functions/whatsapp-send-text/index.ts`

Adicionar delay configuraavel para envios em lote:

```typescript
// Adicionar delay opcional para evitar rate limit
const delay = parseInt(Deno.env.get('WHATSAPP_SEND_DELAY_MS') || '0');
if (delay > 0) {
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Enviar mensagem via Evolution API
const response = await fetch(...);
```

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/whatsapp-send-text/index.ts` | Corrigir formatacao telefone, adicionar delay |
| `supabase/functions/notificar-cliente/index.ts` | Trocar para whatsapp-send-text, adicionar template |
| `supabase/functions/enviar-lembretes-vencimento/index.ts` | Chamar whatsapp-send-text em vez de apenas registrar |
| `src/hooks/usePropostasPendentes.ts` | Adicionar notificacao WhatsApp ao solicitar docs |
| `src/components/assistencia/EnviarLinkPrestadorButton.tsx` | Adicionar envio via Evolution API |

---

## Verificacoes a Fazer

### Formatacao do Numero

| Cenario | Entrada | Saida Esperada |
|---------|---------|----------------|
| Numero completo | 5599999999999 | 5599999999999 |
| Sem DDI | 99999999999 | 5599999999999 |
| Com mascara | (99) 99999-9999 | 5599999999999 |
| Celular 8 digitos | 99999999 | 559999999999 (DDD ausente!) |

### Delay entre Mensagens

| Volume | Delay Recomendado |
|--------|-------------------|
| Envio unitario | 0ms |
| Lote ate 10 | 500ms |
| Lote ate 50 | 1000ms |
| Lote 100+ | 2000ms + jitter |

---

## Checklist de Verificacao Pos-Implementacao

- [ ] Telefone formatado com prefixo 55 automaticamente
- [ ] Mensagem de texto enviada completa sem truncamento
- [ ] Delay configuravel para envios em lote
- [ ] Erros logados com detalhes da Evolution API
- [ ] Status da mensagem atualizado no banco (enviada/erro)
- [ ] notificar-cliente usa whatsapp-send-text
- [ ] Lembretes de vencimento sao enviados (nao apenas registrados)
- [ ] Documentos solicitados gera notificacao WhatsApp
- [ ] Assistencia 24h pode enviar via Evolution (nao apenas wa.me)

---

## Teste Recomendado: Envio de Mensagem de Texto

### Pre-requisitos

1. WhatsApp conectado via QR Code
2. Numero de teste cadastrado como associado
3. Acesso como diretor no sistema

### Passos do Teste

1. Acessar painel administrativo
2. Abrir uma cotacao ou associado com telefone valido
3. Executar acao que envia WhatsApp (ex: confirmar agendamento)
4. Verificar que mensagem chegou no WhatsApp do destinatario
5. Verificar registro na tabela `whatsapp_mensagens`
6. Verificar logs da edge function no Supabase

### Resultado Esperado

- Mensagem recebida no WhatsApp do destinatario
- Texto completo sem truncamento
- Status "enviada" no banco
- Log de sucesso no console da edge function

