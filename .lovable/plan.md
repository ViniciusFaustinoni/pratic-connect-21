
# Revisao Completa - WhatsApp via Evolution API no Modulo de Sinistros

## Resumo Executivo

| Momento do Fluxo | Status WhatsApp | Implementacao Atual |
|------------------|-----------------|---------------------|
| 1. Sinistro comunicado - confirmacao com protocolo | **PARCIAL** | Cria notificacao no sistema + email. WhatsApp **COMENTADO** |
| 2. Documentos solicitados - lista detalhada | **NAO IMPLEMENTADO** | Apenas toast local, sem WhatsApp |
| 3. Documento recebido - confirmacao | **NAO IMPLEMENTADO** | Apenas notificacao para analista |
| 4. Atualizacao de analise - status atual | **NAO IMPLEMENTADO** | Sem WhatsApp automatico |
| 5. Sinistro aprovado - proximos passos | **PARCIAL** | Template existe mas WhatsApp **COMENTADO** |
| 6. Sinistro negado - motivo e recurso | **PARCIAL** | Template existe mas WhatsApp **COMENTADO** |
| 7. Reparo/indenizacao concluido - confirmacao final | **PARCIAL** | Template existe mas WhatsApp **COMENTADO** |
| Enviar fotos via WhatsApp | **PARCIAL** | Vinculacao apenas para documentos de CADASTRO |
| Documentos vinculados ao sinistro | **NAO IMPLEMENTADO** | Funcao vincula apenas em documentos gerais |
| Atualizacoes proativas | **NAO IMPLEMENTADO** | Associado precisa abrir o app |
| Prazo de cada etapa informado | **NAO IMPLEMENTADO** | Sem SLAs definidos nas mensagens |

---

## Analise Detalhada

### 1. Sinistro Comunicado - Confirmacao com Protocolo - PARCIAL

**Situacao atual:** `criar-sinistro/index.ts` linhas 535-562

```typescript
// Linha 552-562 - Chama notificar-sinistro
try {
  await supabaseAdmin.functions.invoke('notificar-sinistro', {
    body: { sinistro_id: sinistro.id, status: 'comunicado' }
  });
} catch (e) {
  console.log('[criar-sinistro] Notificação adicional não enviada:', e);
}
```

**Problema:** Em `notificar-sinistro/index.ts` linhas 155-177, o codigo WhatsApp esta **COMENTADO**:

```typescript
// TODO: Integração com Evolution API (WhatsApp)
// Quando os secrets EVOLUTION_API_URL e EVOLUTION_API_KEY forem configurados:
// 
// const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
// ...
```

**Gap:** O sinistro e criado, notificacao no sistema e criada, email e enviado, mas **WhatsApp NAO e enviado**.

### 2. Documentos Solicitados - Lista Detalhada - NAO IMPLEMENTADO

**Situacao atual:** `SolicitarDocumentosSinistroDialog.tsx`

Quando analista solicita documentos:
- Cria registros em `sinistro_documentos` com status `pendente`
- Atualiza sinistro para `documentacao_pendente`
- Registra no historico
- Exibe toast: "O associado sera notificado sobre a pendencia"

**Gap:** **NAO existe codigo que envia WhatsApp** com a lista de documentos. A notificacao e apenas uma promessa no toast.

### 3. Documento Recebido - Confirmacao - NAO IMPLEMENTADO

**Situacao atual:** `enviar-documento-sinistro/index.ts` linhas 280-305

Quando associado envia documento:
- Upload para storage
- Atualiza `sinistro_documentos` com status `enviado`
- Se todos enviados, muda sinistro para `em_analise`
- Notifica **analista** (nao associado)

```typescript
// Linha 291-299 - Notifica apenas o analista
await supabaseAdmin.from('notificacoes').insert({
  usuario_id: analistaProfile.id,
  titulo: '📄 Novo documento recebido',
  mensagem: `O associado enviou o documento...`
});
```

**Gap:** O **associado NAO recebe confirmacao** de que o documento foi recebido e esta em analise.

### 4. Atualizacao de Analise - Status Atual - NAO IMPLEMENTADO

**Situacao atual:** `AtualizarStatusModal.tsx`

Quando status muda:
- Atualiza tabela `sinistros`
- Registra no historico
- Toast local

**Gap:** **Nenhuma chamada** para `notificar-sinistro` ou `disparar-notificacao`. Associado precisa abrir o app.

### 5. Sinistro Aprovado - Proximos Passos - PARCIAL

**Situacao atual:** `EmitirParecerModal.tsx` linhas 108-188

Quando sinistro e aprovado:
- Atualiza sinistro com parecer, valor e tipo_dano
- Registra no historico
- Se perda total, inativa veiculo

**Gap:** **NAO chama** `notificar-sinistro`. O template existe em `notificar-sinistro`:

```typescript
aprovado: {
  titulo: '✅ Sinistro Aprovado',
  mensagem: (protocolo) => `Ótima notícia! Seu sinistro ${protocolo} foi APROVADO. Verifique os detalhes no app.`,
}
```

Mas nunca e chamado quando o parecer e emitido.

### 6. Sinistro Negado - Motivo e Recurso - PARCIAL

**Situacao atual:** Mesmo que o aprovado, em `EmitirParecerModal.tsx`.

Template existe:

```typescript
negado: {
  titulo: 'Sinistro Negado',
  mensagem: (protocolo) => `Seu sinistro ${protocolo} foi negado. Consulte o parecer no app para mais informações.`,
}
```

**Gap:** 
- NAO e chamado apos emitir parecer
- NAO informa motivo na mensagem
- NAO menciona possibilidade de recurso

### 7. Reparo/Indenizacao Concluido - NAO IMPLEMENTADO

**Situacao atual:** `AtualizarStatusModal.tsx` permite mudar para `pago` ou `encerrado`, mas:
- NAO envia WhatsApp
- Template `pago` existe mas nunca e chamado:

```typescript
pago: {
  titulo: '💰 Pagamento Realizado',
  mensagem: (protocolo) => `O pagamento referente ao sinistro ${protocolo} foi realizado com sucesso!`,
}
```

---

## Envio de Fotos via WhatsApp - PARCIAL

**Situacao atual:** `whatsapp-webhook/index.ts` linhas 26-145

A funcao `vincularMidiaADocumentoPendente` existe, mas:
- Vincula **apenas para documentos de CADASTRO** (tabela `documentos`)
- Busca associados com status `documentacao_pendente`, `pre_cadastro`, etc.
- **NAO verifica** `sinistro_documentos` pendentes

```typescript
// Linha 51-58 - Busca apenas documentos_solicitados (cadastro)
const { data: docsPendentes } = await supabase
  .from("documentos_solicitados")  // <-- APENAS CADASTRO
  .select("id, tipo_documento, contrato_id, associado_id")
  .eq("associado_id", associado.id)
  .eq("status", "pendente")
```

**Gap:** Fotos enviadas via WhatsApp **NAO sao vinculadas** a sinistros em andamento. Associado precisa usar o app.

---

## Documentos Vinculados ao Sinistro Correto - NAO IMPLEMENTADO

Para vincular automaticamente, seria necessario:
1. Verificar se associado tem sinistro com status `documentacao_pendente`
2. Listar documentos pendentes em `sinistro_documentos`
3. Vincular midia recebida ao documento pendente mais antigo
4. Confirmar recebimento via WhatsApp

**Status:** Nao implementado. O sistema atual so vincula documentos de cadastro.

---

## Atualizacoes Proativas - NAO IMPLEMENTADO

O sistema atual e **reativo**: associado precisa abrir o app para ver mudancas.

Para ser proativo:
- Cada mudanca de status deveria chamar `notificar-sinistro` ou `disparar-notificacao`
- A funcao de notificacao deveria enviar WhatsApp (codigo atualmente comentado)

---

## Prazo de Cada Etapa - NAO IMPLEMENTADO

Nenhuma mensagem informa prazos esperados. Exemplo de como deveria ser:

| Status | Mensagem Ideal |
|--------|----------------|
| comunicado | "Seu sinistro sera analisado em ate 24h uteis" |
| documentacao_pendente | "Envie os documentos em ate 48h para nao atrasar" |
| em_analise | "A analise sera concluida em ate 5 dias uteis" |
| aprovado | "O pagamento sera processado em ate 10 dias uteis" |

---

## Pagina de Avaliacao de Sinistro - NAO EXISTE

Diferente da Assistencia 24h (que agora tem `/avaliar/assistencia/:id`), **nao existe** pagina de avaliacao para sinistros.

A tabela `sinistros` **nao tem** colunas de avaliacao (`avaliacao_nota`, `avaliacao_comentario`).

---

## Plano de Implementacao

### Fase 1: Ativar WhatsApp na Funcao Existente

**Modificar:** `supabase/functions/notificar-sinistro/index.ts`

Descomentar e ajustar codigo WhatsApp:

```typescript
// Linha 155-177 - ATIVAR
const telefone = associado.whatsapp || associado.telefone;
if (telefone) {
  try {
    await supabase.functions.invoke('whatsapp-send-text', {
      body: {
        telefone: telefone.replace(/\D/g, ''),
        mensagem: `*${titulo}*\n\n${mensagem}`,
      },
    });
    console.log(`[notificar-sinistro] WhatsApp enviado para ${telefone}`);
  } catch (whatsErr) {
    console.error(`[notificar-sinistro] Erro WhatsApp:`, whatsErr);
  }
}
```

### Fase 2: Notificar ao Solicitar Documentos

**Modificar:** `src/components/sinistros/SolicitarDocumentosSinistroDialog.tsx`

Apos inserir documentos (linha 76), chamar notificacao:

```typescript
// Apos inserir documentos pendentes
const documentosFormatados = documentosSelecionados
  .map(id => TIPOS_DOCUMENTOS_SINISTRO.find(d => d.id === id)?.label)
  .join('\n• ');

await supabase.functions.invoke('whatsapp-send-text', {
  body: {
    telefone: associado.whatsapp || associado.telefone,
    mensagem: `📄 *Documentos Solicitados*\n\nPara dar continuidade ao seu sinistro ${protocolo}, precisamos dos seguintes documentos:\n\n• ${documentosFormatados}\n\n⏰ Prazo: 48 horas\n\nEnvie pelo app ou responda esta mensagem com as fotos.`,
  },
});
```

### Fase 3: Confirmar Recebimento de Documento

**Modificar:** `supabase/functions/enviar-documento-sinistro/index.ts`

Apos vincular documento (linha 236), notificar associado:

```typescript
// Notificar associado que documento foi recebido
const telefoneAssociado = associado.whatsapp || associado.telefone;
if (telefoneAssociado) {
  const mensagem = documentosRestantes > 0
    ? `✅ *Documento Recebido*\n\nRecebemos seu documento "${tipo_documento}".\n\n📋 Ainda faltam ${documentosRestantes} documento(s).\n\nEnvie os demais para dar continuidade.`
    : `✅ *Todos os Documentos Recebidos*\n\nRecebemos todos os documentos solicitados!\n\n🔍 Seu sinistro ${sinistro.protocolo} entrou em análise.\n\n⏰ Prazo estimado: 5 dias úteis.`;

  await supabaseAdmin.functions.invoke('whatsapp-send-text', {
    body: { telefone: telefoneAssociado, mensagem }
  });
}
```

### Fase 4: Notificar ao Atualizar Status

**Modificar:** `src/components/eventos/AtualizarStatusModal.tsx`

Apos atualizar status (linha 103), chamar notificacao:

```typescript
// Notificar associado
await supabase.functions.invoke('notificar-sinistro', {
  body: {
    sinistro_id: sinistro.id,
    status: novoStatus,
  }
});
```

### Fase 5: Notificar ao Emitir Parecer

**Modificar:** `src/components/eventos/EmitirParecerModal.tsx`

Apos registrar parecer (linha 145), adicionar:

```typescript
// Notificar associado via WhatsApp
await supabase.functions.invoke('notificar-sinistro', {
  body: {
    sinistro_id: sinistro.id,
    status: novoStatus, // 'aprovado' ou 'negado'
    dados_extras: {
      valor_indenizacao: valorIndenizacao,
      tipo_dano: tipoDano,
      parecer: parecer.substring(0, 200), // Resumo do parecer
    }
  }
});
```

### Fase 6: Vincular Fotos via WhatsApp a Sinistros

**Modificar:** `supabase/functions/whatsapp-webhook/index.ts`

Criar funcao `vincularMidiaASinistroPendente`:

```typescript
async function vincularMidiaASinistroPendente(
  supabase: any,
  telefonesBusca: string[],
  mediaArmazenada: string,
  instancia: any
): Promise<{ vinculado: boolean; mensagem?: string }> {
  // Buscar associado
  const { data: associado } = await supabase
    .from("associados")
    .select("id, nome")
    .or(`whatsapp.in.(${telefonesBusca.join(",")}),telefone.in.(${telefonesBusca.join(",")})`)
    .maybeSingle();

  if (!associado) return { vinculado: false };

  // Buscar sinistro com documentos pendentes
  const { data: sinistros } = await supabase
    .from("sinistros")
    .select("id, protocolo, status")
    .eq("associado_id", associado.id)
    .eq("status", "documentacao_pendente")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!sinistros?.length) return { vinculado: false };

  const sinistro = sinistros[0];

  // Buscar documento pendente mais antigo
  const { data: docsPendentes } = await supabase
    .from("sinistro_documentos")
    .select("id, tipo, nome")
    .eq("sinistro_id", sinistro.id)
    .eq("status", "pendente")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!docsPendentes?.length) return { vinculado: false };

  const doc = docsPendentes[0];

  // Atualizar documento
  await supabase
    .from("sinistro_documentos")
    .update({
      arquivo_url: mediaArmazenada,
      status: "enviado",
      enviado_em: new Date().toISOString(),
    })
    .eq("id", doc.id);

  return {
    vinculado: true,
    mensagem: `✅ Recebemos sua foto para o sinistro ${sinistro.protocolo}!\n\nDocumento: ${doc.nome}\n\nAguarde a análise.`,
  };
}
```

Chamar antes da vinculacao de cadastro (linha 2022):

```typescript
// Tentar vincular a sinistro primeiro
const resultadoSinistro = await vincularMidiaASinistroPendente(supabase, telefonesBusca, mediaArmazenada, instancia);
if (resultadoSinistro.vinculado) {
  if (resultadoSinistro.mensagem) {
    await sendWhatsAppMessage(instancia.api_url, instancia.instance_name, telefone, resultadoSinistro.mensagem);
  }
  return new Response(JSON.stringify({ ok: true, vinculado_sinistro: true }), { headers: corsHeaders });
}

// Se nao vinculou a sinistro, tentar cadastro
const resultadoVinculo = await vincularMidiaADocumentoPendente(...);
```

### Fase 7: Melhorar Templates com Prazos e Proximos Passos

**Modificar:** `supabase/functions/notificar-sinistro/index.ts`

```typescript
const STATUS_TEMPLATES = {
  comunicado: {
    titulo: '✅ Sinistro Registrado',
    mensagem: (protocolo) => `Seu sinistro foi registrado!\n\n📋 Protocolo: ${protocolo}\n\n⏰ Próximos passos:\n1. Analisaremos em até 24h úteis\n2. Se necessário, solicitaremos documentos\n3. Acompanhe pelo app`,
  },
  documentacao_pendente: {
    titulo: '📄 Documentos Pendentes',
    mensagem: (protocolo) => `Precisamos de documentos para o sinistro ${protocolo}.\n\n⏰ Prazo: 48 horas\n\nEnvie pelo app ou responda esta mensagem com as fotos.`,
  },
  em_analise: {
    titulo: '🔍 Em Análise',
    mensagem: (protocolo) => `Todos os documentos do sinistro ${protocolo} foram recebidos!\n\n⏰ Prazo de análise: até 5 dias úteis\n\nVocê será notificado sobre o resultado.`,
  },
  aprovado: {
    titulo: '🎉 Sinistro APROVADO!',
    mensagem: (protocolo) => `Ótima notícia! Seu sinistro ${protocolo} foi APROVADO!\n\n💰 Próximos passos:\n1. Verificaremos dados bancários\n2. Pagamento em até 10 dias úteis\n\nAcompanhe os detalhes no app.`,
  },
  negado: {
    titulo: '❌ Sinistro Negado',
    mensagem: (protocolo) => `Seu sinistro ${protocolo} foi negado.\n\n📝 Consulte o parecer completo no app.\n\n⚖️ Você pode solicitar revisão em até 15 dias.\n\nDúvidas? Entre em contato.`,
  },
  pago: {
    titulo: '💰 Pagamento Realizado!',
    mensagem: (protocolo) => `O pagamento do sinistro ${protocolo} foi realizado!\n\n✅ Confira sua conta bancária\n\nAgradecemos a confiança!`,
  },
  encerrado: {
    titulo: '✔️ Sinistro Encerrado',
    mensagem: (protocolo) => `Seu sinistro ${protocolo} foi encerrado.\n\n⭐ Como foi nossa análise?\n\nConte-nos sua experiência!`,
  },
};
```

### Fase 8: Criar Pagina de Avaliacao de Sinistro

**Criar:** `src/pages/avaliar/AvaliarSinistro.tsx`

Similar a `AvaliarAssistencia.tsx`, permitindo que associado avalie:
- Atendimento geral
- Clareza nas comunicacoes
- Prazo de resolucao
- Comentario livre

**Migrar banco:** Adicionar colunas em `sinistros`:
- `avaliacao_nota`
- `avaliacao_comentario`
- `avaliacao_data`

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/notificar-sinistro/index.ts` | Ativar WhatsApp + melhorar templates |
| `src/components/sinistros/SolicitarDocumentosSinistroDialog.tsx` | Enviar lista via WhatsApp |
| `supabase/functions/enviar-documento-sinistro/index.ts` | Confirmar recebimento ao associado |
| `src/components/eventos/AtualizarStatusModal.tsx` | Chamar notificar-sinistro |
| `src/components/eventos/EmitirParecerModal.tsx` | Notificar ao aprovar/negar |
| `supabase/functions/whatsapp-webhook/index.ts` | Vincular fotos a sinistros |

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/avaliar/AvaliarSinistro.tsx` | Pagina publica para avaliar sinistro |
| Migracao SQL | Adicionar colunas de avaliacao em sinistros |

---

## Fluxo de Notificacoes Proposto

```text
1. Associado comunica sinistro
   └── WhatsApp: "✅ Sinistro registrado! Protocolo: SIN-..."

2. Analista solicita documentos
   └── WhatsApp: "📄 Documentos pendentes: BO, CNH, fotos..."

3. Associado envia documento (app ou WhatsApp)
   └── WhatsApp: "✅ Documento recebido! Faltam X..."

4. Todos documentos enviados
   └── WhatsApp: "🔍 Sinistro em análise. Prazo: 5 dias"

5. Parecer emitido
   └── WhatsApp APROVADO: "🎉 Aprovado! Pagamento em 10 dias"
   └── WhatsApp NEGADO: "❌ Negado. Veja parecer. Pode recorrer"

6. Pagamento realizado
   └── WhatsApp: "💰 Pagamento realizado! Confira conta"

7. Sinistro encerrado
   └── WhatsApp: "✔️ Encerrado. Avalie: [link]"
```

---

## Checklist Pos-Implementacao

- [ ] Associado recebe WhatsApp ao comunicar sinistro
- [ ] Associado recebe WhatsApp com lista de documentos solicitados
- [ ] Associado recebe confirmacao ao enviar documento
- [ ] Associado recebe WhatsApp quando status muda
- [ ] Associado recebe WhatsApp quando sinistro e aprovado com proximos passos
- [ ] Associado recebe WhatsApp quando sinistro e negado com orientacao de recurso
- [ ] Associado recebe WhatsApp quando pagamento e realizado
- [ ] Fotos enviadas via WhatsApp sao vinculadas ao sinistro correto
- [ ] Mensagens informam prazos de cada etapa
- [ ] Pagina de avaliacao de sinistro funcionando
