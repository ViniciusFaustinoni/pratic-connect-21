
# Revisao Completa - WhatsApp via Evolution API no Modulo de Cadastro

## Resumo Executivo

| Momento do Fluxo | Status WhatsApp | Implementacao |
|------------------|-----------------|---------------|
| 1. Documentos solicitados ao cliente | **OK** | `notificar-cliente` com tipo `documentos_solicitados` |
| 2. Documento aprovado | **NAO IMPLEMENTADO** | Sem notificacao |
| 3. Documento reprovado | **NAO IMPLEMENTADO** | Sem notificacao |
| 4. Cadastro aprovado (boas-vindas) | **PARCIAL** | Enviado apenas na ativacao do rastreador |
| 5. Lembrete de pendencia documental | **NAO IMPLEMENTADO** | Sem cron/trigger |
| 6. Instalacao agendada | **OK** | Template `instalacao_agendada` existe |
| Cliente pode enviar documentos via WhatsApp | **NAO IMPLEMENTADO** | Fotos nao sao vinculadas |
| Analista pode comunicar diretamente | **NAO IMPLEMENTADO** | Sem chat direto no cadastro |

---

## Analise Detalhada

### 1. Documentos Solicitados ao Cliente - FUNCIONANDO

**Arquivo:** `src/hooks/usePropostasPendentes.ts` (linha 1627-1638)

```typescript
// 4. Enviar notificação via WhatsApp
await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'documentos_solicitados',
    associado_id: associadoId,
    dados: {
      documentos: documentos.join(', '),
      observacoes: observacoes || '',
    },
  },
});
```

**Template em `notificar-cliente/index.ts`:**
```
Olá {nome}! Precisamos de alguns documentos para dar continuidade ao seu cadastro: {documentos}. Acesse o link de acompanhamento para enviar.
```

**Status:** Funcionando corretamente.

---

### 2. Documento Aprovado - NAO IMPLEMENTADO

**Arquivo:** `src/hooks/useDocumentos.ts` (linha 265-289)

```typescript
const aprovarDocumento = useMutation({
  mutationFn: async (id: string) => {
    await supabase
      .from('documentos')
      .update({
        status: 'aprovado',
        analista_id: user.id,
        data_analise: new Date().toISOString(),
      })
      .eq('id', id);
  },
  onSuccess: () => {
    toast.success('Documento aprovado!');
    // ❌ NÃO ENVIA WHATSAPP
  },
});
```

**Gap:** Nao ha notificacao via WhatsApp quando documento e aprovado.

---

### 3. Documento Reprovado - NAO IMPLEMENTADO

**Arquivo:** `src/hooks/useDocumentos.ts` (linha 292-321)

```typescript
const reprovarDocumento = useMutation({
  mutationFn: async ({ id, motivo, observacao }) => {
    await supabase
      .from('documentos')
      .update({
        status: 'reprovado',
        motivo_reprovacao: motivoCompleto,
      })
      .eq('id', id);
  },
  onSuccess: () => {
    toast.success('Documento reprovado');
    // ❌ NÃO ENVIA WHATSAPP COM MOTIVO
  },
});
```

**Gap:** O cliente nao recebe notificacao com motivo da reprovacao e orientacao para reenvio.

---

### 4. Cadastro Aprovado (Boas-Vindas) - PARCIAL

**Situacao atual:** A mensagem de boas-vindas so e enviada quando o **rastreador e ativado** (nao quando cadastro e aprovado).

**Arquivo:** `supabase/functions/ativar-associado/index.ts` (linha 210-223)

```typescript
// Enviar WhatsApp (se configurado)
if (associado.whatsapp || associado.telefone) {
  await supabaseAdmin.functions.invoke('whatsapp-send-media', {
    body: {
      telefone: telefoneWhatsapp,
      mensagem: `Olá ${associado.nome}! 🚗\n\nSeu acesso ao App PRATIC está liberado!\n\n🔗 URL: ${appUrl}/app/login\n👤 Login: ${associado.cpf}\n🔑 Senha: ${senhaPadrao}`,
    }
  });
}
```

**Gap:** Template `boas_vindas` existe em `disparar-notificacao` mas nao e usado no fluxo de aprovacao do cadastro.

---

### 5. Lembrete de Pendencia Documental - NAO IMPLEMENTADO

**Existe:** Cron `enviar-lembretes-vencimento` apenas para **boletos vencendo**.

**Nao existe:** Cron ou trigger para lembrar cliente sobre documentos pendentes apos X dias.

**Gap:** Tabela `documentos_solicitados` com status `pendente` nao dispara lembretes automaticos.

---

### 6. Instalacao Agendada - OK

**Template existe em `notificar-cliente/index.ts`:**

```typescript
instalacao_agendada: {
  titulo: '📅 Instalação Agendada!',
  mensagem: 'Olá {nome}! Sua instalação foi agendada para {data}. Nosso técnico entrará em contato.',
}
```

**Status:** Template existe, precisa verificar se e chamado nos fluxos de agendamento.

---

### 7. Cliente Enviar Documentos via WhatsApp - NAO IMPLEMENTADO

**Situacao atual:** O webhook `whatsapp-webhook` processa fotos recebidas, mas:

- **NAO verifica** se o remetente tem documentos pendentes (`documentos_solicitados`)
- **NAO vincula** a foto recebida ao documento solicitado
- Apenas armazena no bucket `sinistros` (linha 1775 do webhook)

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts` (linhas 1765-1778)

```typescript
case 'imagem': {
  mediaUrl = tipoMensagem.imagem.url;
  mediaMimetype = tipoMensagem.imagem.mimetype;
  
  // Baixar e armazenar imagem
  const mediaResult = await downloadMediaEvolution(...);
  if (mediaResult.success && mediaResult.base64) {
    mediaArmazenada = await storeMediaSupabase(supabase, mediaResult.base64, ...);
    // ❌ NÃO VERIFICA documentos_solicitados
    // ❌ NÃO CRIA registro em contratos_documentos
    // ❌ NÃO ATUALIZA status do documento_solicitado
  }
  
  mensagemTexto = captionImagem ? `[Imagem]: ${captionImagem}` : '[Imagem recebida]';
}
```

---

### 8. Analista Comunicar Diretamente com Cliente - NAO IMPLEMENTADO

**Situacao:** Chat direto so existe no modulo de **Sinistros** (`sinistros_mensagens`).

**Gap:** Nao ha componente de chat no fluxo de cadastro para o analista enviar mensagens ao cliente.

---

## Plano de Implementacao

### Fase 1: Notificacoes de Documentos (Aprovado/Reprovado)

**Adicionar templates em `notificar-cliente/index.ts`:**

```typescript
documento_aprovado: {
  titulo: '✅ Documento Aprovado',
  mensagem: 'Olá {nome}! O documento "{tipo_documento}" foi aprovado. {mensagem_adicional}',
  emailTemplate: 'generico',
},
documento_reprovado: {
  titulo: '⚠️ Documento Precisa de Ajuste',
  mensagem: 'Olá {nome}! O documento "{tipo_documento}" precisa ser reenviado. Motivo: {motivo}. Acesse o link de acompanhamento para enviar novamente.',
  emailTemplate: 'generico',
},
```

**Modificar `src/hooks/useDocumentos.ts`:**

```typescript
// Em aprovarDocumento.onSuccess
await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'documento_aprovado',
    associado_id: documentoData.associado_id,
    dados: { tipo_documento: documentoData.tipo },
  },
});

// Em reprovarDocumento.onSuccess
await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'documento_reprovado',
    associado_id: documentoData.associado_id,
    dados: { tipo_documento: documentoData.tipo, motivo: motivoCompleto },
  },
});
```

---

### Fase 2: Vincular Fotos Recebidas via WhatsApp ao Cadastro

**Modificar `whatsapp-webhook/index.ts`:**

Apos receber imagem/documento de associado com status `documentacao_pendente`:

```typescript
case 'imagem':
case 'documento': {
  // Apos armazenar mídia...
  
  // Verificar se associado tem documentos pendentes
  if (associado && associado.status === 'documentacao_pendente') {
    const { data: docsPendentes } = await supabase
      .from('documentos_solicitados')
      .select('id, tipo_documento')
      .eq('associado_id', associado.id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (docsPendentes && docsPendentes.length > 0) {
      const docSolicitado = docsPendentes[0];
      
      // Criar documento
      const { data: novoDoc } = await supabase
        .from('documentos')
        .insert({
          associado_id: associado.id,
          tipo: mapTipoParaEnum(docSolicitado.tipo_documento),
          arquivo_url: mediaArmazenada,
          nome_arquivo: mediaFilename || 'documento_whatsapp',
          status: 'pendente',
        })
        .select()
        .single();
      
      // Atualizar documento_solicitado
      await supabase
        .from('documentos_solicitados')
        .update({
          status: 'enviado',
          enviado_em: new Date().toISOString(),
          documento_id: novoDoc.id,
        })
        .eq('id', docSolicitado.id);
      
      // Responder ao cliente
      mensagemTexto = `✅ Documento "${formatTipo(docSolicitado.tipo_documento)}" recebido! Aguarde a análise.`;
    }
  }
}
```

---

### Fase 3: Lembrete de Pendencia Documental

**Criar edge function:** `supabase/functions/cron-lembrete-documentos/index.ts`

```typescript
// Buscar documentos pendentes há mais de 3 dias
const { data: pendentes } = await supabase
  .from('documentos_solicitados')
  .select(`
    id, 
    tipo_documento, 
    created_at,
    associado:associados(id, nome, whatsapp, telefone)
  `)
  .eq('status', 'pendente')
  .lt('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());

for (const doc of pendentes) {
  await supabase.functions.invoke('whatsapp-send-text', {
    body: {
      telefone: doc.associado.whatsapp || doc.associado.telefone,
      mensagem: `Olá ${doc.associado.nome}! 📋\n\nLembramos que ainda aguardamos o envio do documento: *${formatTipo(doc.tipo_documento)}*.\n\nAcesse o link de acompanhamento para enviar.`,
    },
  });
}
```

---

### Fase 4: Boas-Vindas na Aprovacao do Cadastro

**Adicionar template de boas-vindas especifico:**

```typescript
cadastro_aprovado: {
  titulo: '🎉 Cadastro Aprovado!',
  mensagem: 'Parabéns {nome}! Seu cadastro foi aprovado. Em breve entraremos em contato para agendar a instalação do rastreador e ativar sua proteção.',
}
```

**Chamar quando status mudar para `aprovado`** (na mutation de aprovacao de proposta).

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/notificar-cliente/index.ts` | Adicionar templates `documento_aprovado`, `documento_reprovado`, `cadastro_aprovado` |
| `src/hooks/useDocumentos.ts` | Adicionar envio de WhatsApp ao aprovar/reprovar |
| `supabase/functions/whatsapp-webhook/index.ts` | Vincular fotos recebidas a documentos pendentes |

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/cron-lembrete-documentos/index.ts` | Lembrete automatico de documentos pendentes |

---

## Checklist Pos-Implementacao

- [ ] Cliente recebe WhatsApp ao ter documento solicitado
- [ ] Cliente recebe WhatsApp ao ter documento aprovado
- [ ] Cliente recebe WhatsApp ao ter documento reprovado (com motivo)
- [ ] Cliente recebe WhatsApp de boas-vindas ao ter cadastro aprovado
- [ ] Cliente recebe lembrete apos 3 dias com documentos pendentes
- [ ] Cliente recebe confirmacao ao ter instalacao agendada
- [ ] Fotos enviadas via WhatsApp sao vinculadas ao documento pendente correto
- [ ] Analista pode enviar mensagem direta ao cliente pelo painel

---

## Testes Recomendados

### Teste 1: Solicitacao de Documento

1. Acessar Cadastro > Proposta
2. Clicar em "Solicitar Documentos"
3. Selecionar CNH
4. Verificar se cliente recebe WhatsApp com lista de documentos

### Teste 2: Aprovacao de Documento

1. Acessar fila de documentos
2. Aprovar um documento
3. Verificar se cliente recebe WhatsApp de confirmacao

### Teste 3: Reprovacao de Documento

1. Reprovar documento com motivo "ilegivel"
2. Verificar se cliente recebe WhatsApp com motivo e orientacao

### Teste 4: Envio de Foto via WhatsApp

1. Como cliente, enviar foto para numero da associacao
2. Verificar se foto aparece vinculada na proposta
3. Verificar se status do documento_solicitado muda para "enviado"

---

## Detalhes Tecnicos

### Mapeamento de Tipos de Documento

Para vincular fotos recebidas via WhatsApp, usar contexto da conversa ou perguntar ao cliente:

```typescript
// Tool para IA perguntar qual documento
{
  type: "function",
  function: {
    name: "identificar_documento_enviado",
    description: "Pergunta ao cliente qual tipo de documento está sendo enviado quando há múltiplos pendentes",
    parameters: { type: "object", properties: {}, required: [] },
  },
}
```

### Prazo de Documentacao

Comunicar prazos claramente nas mensagens:

```
Você tem 7 dias para enviar os documentos solicitados.
Após esse prazo, sua proposta poderá ser cancelada automaticamente.
```
