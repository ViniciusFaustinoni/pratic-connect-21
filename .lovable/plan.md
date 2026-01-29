
# Revisao Completa - Fluxo de Envio de Midia via Evolution API

## Resumo Executivo

| Cenario | Status | Implementacao | Observacoes |
|---------|--------|---------------|-------------|
| Sistema envia boleto PDF ao associado | **NAO IMPLEMENTADO** | Nenhum | Apenas link wa.me, sem envio de arquivo |
| Sistema envia contrato para assinatura | **NAO IMPLEMENTADO** | Nenhum | Apenas link wa.me com URL Autentique |
| IA envia boleto PDF via WhatsApp | **NAO IMPLEMENTADO** | `whatsapp-webhook` | IA consulta boletos, mas NAO envia PDF |
| IA envia contrato PDF via WhatsApp | **NAO IMPLEMENTADO** | Nenhum | Nao existe funcionalidade |
| Modal manual de envio de documento | **IMPLEMENTADO** | `ModalEnviarWhatsApp` | Funciona via `whatsapp-send-media` |

---

## Analise Detalhada

### 1. Envio de Boleto PDF para Associado

**STATUS: NAO IMPLEMENTADO VIA EVOLUTION API**

O sistema atual apenas abre `wa.me` com link do boleto (URL), nao envia o PDF como arquivo:

**Arquivo:** `src/pages/financeiro/CobrancasList.tsx` (linhas 331-359)

```typescript
const handleEnviarWhatsApp = (cobranca: any) => {
  // ...
  if (cobranca.boleto_url) {
    mensagem += `\n📄 Boleto: ${cobranca.boleto_url}\n`;  // Apenas LINK
  }
  
  const url = `https://wa.me/55${telefoneFormatado}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank');  // Abre navegador, NAO usa Evolution API
};
```

**Arquivo:** `src/pages/financeiro/CobrancaDetalhe.tsx` (linhas 163-188)

Mesmo comportamento: apenas abre `wa.me` com link, nao envia PDF.

**Gap:** O sistema deveria:
1. Baixar o PDF do boleto (via `boleto_url`)
2. Converter para base64
3. Enviar via `POST /message/sendMedia/{instanceName}` com `media_type: 'document'`

---

### 2. Envio de Contrato para Assinatura

**STATUS: NAO IMPLEMENTADO VIA EVOLUTION API**

O sistema envia apenas link do Autentique via `wa.me`:

**Arquivo:** `src/pages/vendas/Contratos.tsx` (linhas 228-237)

```typescript
const handleEnviarWhatsApp = (contrato: typeof contratos[0]) => {
  const client = contrato.associados || contrato.leads;
  const phone = client?.telefone;
  if (!phone || !contrato.autentique_url) {
    toast.error('Telefone ou link não disponível');
    return;
  }
  const url = getWhatsAppLink(phone, contrato.autentique_url, client?.nome);
  window.open(url, '_blank');  // Abre wa.me, NAO envia PDF
};
```

**Gap:** Nao existe opcao de enviar contrato PDF via Evolution API.

---

### 3. IA Envia Boleto PDF via WhatsApp

**STATUS: NAO IMPLEMENTADO**

A IA no webhook (`whatsapp-webhook/index.ts`) tem a tool `get_boletos_pendentes` que retorna dados dos boletos (valor, vencimento, status), mas:

- **NAO retorna URL do boleto** ao associado
- **NAO envia PDF como anexo**
- Apenas retorna texto com informacoes

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts` (linhas 237-261)

```typescript
case "get_boletos_pendentes": {
  const { data } = await supabase
    .from("cobrancas")
    .select("valor, data_vencimento, status")
    .eq("associado_id", associadoId)
    .in("status", ["pendente", "vencido"]);

  // Retorna apenas texto, sem boleto_url ou PDF
  return JSON.stringify({
    boletos: data.map((b: any) => ({
      valor: `R$ ${b.valor?.toFixed(2)}`,
      vencimento: new Date(b.data_vencimento).toLocaleDateString("pt-BR"),
      status: b.status,
    })),
    total: `R$ ${total.toFixed(2)}`,
  });
}
```

**Gap:** Deveria:
1. Incluir `boleto_url` e `pix_copia_cola` na resposta da tool
2. Adicionar nova tool `enviar_boleto_pdf` que envia o documento
3. IA poderia oferecer: "Quer que eu envie o boleto em PDF?"

---

### 4. Modal Manual de Envio de Documento

**STATUS: IMPLEMENTADO CORRETAMENTE**

**Arquivo:** `src/components/documentos/ModalEnviarWhatsApp.tsx`

Este modal funciona corretamente e usa `whatsapp-send-media`:

```typescript
const { enviarDocumento } = useEnviarWhatsApp();

const handleEnviarAPI = async () => {
  const pdfBase64 = arrayBufferToBase64(pdfBytes);
  const resultado = await enviarDocumento({
    telefone,
    nomeDocumento,
    pdfBase64,
    mensagem,
  });
};
```

**Arquivo:** `src/hooks/useEnviarWhatsApp.ts` (linhas 44-71)

```typescript
const enviarDocumento = async ({...}) => {
  const { data, error } = await supabase.functions.invoke('whatsapp-send-media', {
    body: {
      telefone: telefoneFmt,
      media_base64: pdfBase64,
      media_type: 'document',      // CORRETO
      mimetype: 'application/pdf',  // CORRETO
      filename: arquivo,            // CORRETO
      caption: mensagem,            // CORRETO
    },
  });
};
```

Porem, este modal NAO esta sendo usado nas telas de cobranca ou contratos!

---

## Edge Function whatsapp-send-media - Analise

**Arquivo:** `supabase/functions/whatsapp-send-media/index.ts`

### Verificacoes do Payload

| Campo | Validacao | Status |
|-------|-----------|--------|
| `telefone` | Obrigatorio, formatado com 55 | **CORRETO** |
| `media_type` | Obrigatorio: image, document, audio, video | **CORRETO** |
| `mimetype` | Obrigatorio | **CORRETO** |
| `filename` | Obrigatorio para documentos | **CORRETO** |
| `media_url` ou `media_base64` | Pelo menos um obrigatorio | **CORRETO** |
| `caption` | Opcional | **CORRETO** |

### Montagem do Body para Evolution API

```typescript
const mediaBody: Record<string, unknown> = {
  number: telefoneFormatado,
  mediatype: payload.media_type,   // CORRETO: image, document, etc
  mimetype: payload.mimetype,      // CORRETO: application/pdf, etc
  caption: payload.caption || '',  // CORRETO: legenda
  media: payload.media_base64 || payload.media_url,  // CORRETO: base64 ou URL
};

if (payload.filename) {
  mediaBody.fileName = payload.filename;  // CORRETO para documentos
}
```

### Chamada da Evolution API

```typescript
const response = await fetch(
  `${instancia.api_url}/message/sendMedia/${instancia.instance_name}`,
  {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mediaBody)
  }
);
```

**Status:** A edge function esta correta! O problema e que ela NAO esta sendo usada nos fluxos de boleto e contrato.

---

## Gaps Identificados

### Gap 1: Cobrancas NAO Enviam PDF via Evolution API

As telas de cobranca apenas abrem `wa.me` com link de texto.

### Gap 2: Contratos NAO Enviam PDF via Evolution API

Apenas link Autentique e enviado via `wa.me`.

### Gap 3: IA NAO Envia Boletos como Anexo

A tool `get_boletos_pendentes` nao retorna URL nem envia PDF.

### Gap 4: Nenhuma Integracao Automatica

Boletos e contratos nunca sao enviados automaticamente como PDF.

---

## Plano de Implementacao

### Fase 1: Enviar Boleto PDF nas Telas de Cobranca

**Modificar:** `src/pages/financeiro/CobrancasList.tsx`

Adicionar funcao para enviar boleto via Evolution API:

```typescript
const handleEnviarBoletoPDF = async (cobranca: any) => {
  const telefone = cobranca.associado?.whatsapp || cobranca.associado?.telefone;
  if (!telefone || !cobranca.boleto_url) {
    toast.error('Telefone ou boleto não disponível');
    return;
  }
  
  try {
    const valor = formatCurrency(Number(cobranca.valor));
    const vencimento = format(parseISO(cobranca.data_vencimento), 'dd/MM/yyyy');
    
    const { error } = await supabase.functions.invoke('whatsapp-send-media', {
      body: {
        telefone: telefone.replace(/\D/g, ''),
        media_url: cobranca.boleto_url,  // URL do PDF do ASAAS
        media_type: 'document',
        mimetype: 'application/pdf',
        filename: `boleto_${cobranca.asaas_id || cobranca.id}.pdf`,
        caption: `📄 Boleto PRATICCAR\n💰 Valor: ${valor}\n📅 Vencimento: ${vencimento}`,
        referencia_tipo: 'cobranca',
        referencia_id: cobranca.id,
      },
    });
    
    if (error) throw error;
    toast.success('Boleto enviado por WhatsApp!');
  } catch (err: any) {
    toast.error(`Erro ao enviar: ${err.message}`);
  }
};
```

**Modificar:** `src/pages/financeiro/CobrancaDetalhe.tsx`

Adicionar mesmo handler para envio de PDF.

### Fase 2: Enviar Contrato PDF nos Contratos

**Modificar:** `src/pages/vendas/Contratos.tsx`

Adicionar opcao de enviar contrato PDF via Evolution API:

```typescript
const handleEnviarContratoPDF = async (contrato: typeof contratos[0]) => {
  const client = contrato.associados || contrato.leads;
  const phone = client?.telefone || client?.whatsapp;
  
  // Buscar URL do PDF assinado (se disponivel)
  const pdfUrl = contrato.arquivo_assinado_url || contrato.autentique_url;
  
  if (!phone || !pdfUrl) {
    toast.error('Telefone ou contrato não disponível');
    return;
  }
  
  try {
    const { error } = await supabase.functions.invoke('whatsapp-send-media', {
      body: {
        telefone: phone.replace(/\D/g, ''),
        media_url: pdfUrl,
        media_type: 'document',
        mimetype: 'application/pdf',
        filename: `contrato_${contrato.id}.pdf`,
        caption: `📋 Proposta de Adesão PRATICCAR\n${client?.nome || ''}\n\nAcesse o link para assinar digitalmente.`,
        referencia_tipo: 'contrato',
        referencia_id: contrato.id,
      },
    });
    
    if (error) throw error;
    toast.success('Contrato enviado por WhatsApp!');
  } catch (err: any) {
    toast.error(`Erro ao enviar: ${err.message}`);
  }
};
```

### Fase 3: IA Envia Boleto PDF quando Solicitado

**Modificar:** `supabase/functions/whatsapp-webhook/index.ts`

1. Atualizar tool `get_boletos_pendentes` para incluir URLs:

```typescript
case "get_boletos_pendentes": {
  const { data } = await supabase
    .from("cobrancas")
    .select("id, valor, data_vencimento, status, boleto_url, pix_copia_cola, linha_digitavel")
    .eq("associado_id", associadoId)
    .in("status", ["pendente", "vencido"]);

  return JSON.stringify({
    boletos: data.map((b: any) => ({
      id: b.id,
      valor: `R$ ${b.valor?.toFixed(2)}`,
      vencimento: new Date(b.data_vencimento).toLocaleDateString("pt-BR"),
      status: b.status,
      boleto_url: b.boleto_url,  // NOVO
      pix: b.pix_copia_cola,     // NOVO
      linha_digitavel: b.linha_digitavel,  // NOVO
    })),
    total: `R$ ${total.toFixed(2)}`,
    instrucao: "Para receber o boleto em PDF, use a tool enviar_boleto_pdf",
  });
}
```

2. Adicionar nova tool `enviar_boleto_pdf`:

```typescript
case "enviar_boleto_pdf": {
  const { boleto_id } = args;
  
  // Buscar boleto
  const { data: boleto } = await supabase
    .from("cobrancas")
    .select("id, valor, data_vencimento, boleto_url, associado_id")
    .eq("id", boleto_id)
    .eq("associado_id", associadoId)
    .single();
  
  if (!boleto || !boleto.boleto_url) {
    return JSON.stringify({ success: false, message: "Boleto não encontrado ou sem PDF" });
  }
  
  // Enviar via whatsapp-send-media
  const { data: sendResult, error } = await supabase.functions.invoke('whatsapp-send-media', {
    body: {
      telefone: telefone,  // Do contexto do webhook
      media_url: boleto.boleto_url,
      media_type: 'document',
      mimetype: 'application/pdf',
      filename: `boleto_praticcar.pdf`,
      caption: `📄 Boleto - Vencimento: ${new Date(boleto.data_vencimento).toLocaleDateString('pt-BR')}`,
    },
  });
  
  return JSON.stringify({ 
    success: !error, 
    message: error ? "Erro ao enviar boleto" : "Boleto enviado! Verifique a conversa." 
  });
}
```

3. Atualizar tools disponíveis no prompt da IA.

### Fase 4: Lote de Boletos via Evolution API

**Modificar:** `src/pages/financeiro/CobrancasList.tsx`

Atualizar `handleEnviarBoletosLote` para enviar PDFs:

```typescript
const handleEnviarBoletosLote = async () => {
  const selecionadas = paginatedCobrancas.filter(c => selectedIds.has(c.id));
  let enviados = 0;
  let erros = 0;
  
  for (const cobranca of selecionadas) {
    try {
      const telefone = cobranca.associado?.whatsapp || cobranca.associado?.telefone;
      if (!telefone || !cobranca.boleto_url) continue;
      
      await supabase.functions.invoke('whatsapp-send-media', {
        body: {
          telefone: telefone.replace(/\D/g, ''),
          media_url: cobranca.boleto_url,
          media_type: 'document',
          mimetype: 'application/pdf',
          filename: `boleto_${cobranca.asaas_id}.pdf`,
          caption: `📄 Boleto PRATICCAR - Vencimento: ${format(parseISO(cobranca.data_vencimento), 'dd/MM/yyyy')}`,
        },
      });
      
      enviados++;
      // Delay entre envios para evitar bloqueio
      await new Promise(r => setTimeout(r, 1000));
    } catch {
      erros++;
    }
  }
  
  toast.success(`${enviados} boleto(s) enviado(s)${erros > 0 ? `, ${erros} erro(s)` : ''}`);
  clearSelection();
};
```

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/pages/financeiro/CobrancasList.tsx` | Adicionar envio de boleto PDF via Evolution API |
| `src/pages/financeiro/CobrancaDetalhe.tsx` | Adicionar envio de boleto PDF via Evolution API |
| `src/pages/vendas/Contratos.tsx` | Adicionar envio de contrato PDF via Evolution API |
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar tool `enviar_boleto_pdf`, incluir URLs em `get_boletos_pendentes` |

---

## Verificacoes a Confirmar

### Parametros do sendMedia

| Parametro | Valor Esperado | Validacao na Edge Function |
|-----------|----------------|---------------------------|
| `media_type` | `document` para PDFs | Aceita: image, document, audio, video |
| `mimetype` | `application/pdf` | Obrigatorio |
| `filename` | `boleto_xxx.pdf` | Obrigatorio para documentos |
| `media_url` | URL publica do PDF | Aceita URL ou base64 |
| `caption` | Texto com emoji | Opcional |

### Formato do Numero

```typescript
// A edge function ja formata corretamente
function formatarTelefone(telefone: string): string {
  let limpo = telefone.replace(/\D/g, '');
  if (!limpo.startsWith('55')) {
    limpo = '55' + limpo;
  }
  return limpo;  // Resultado: 5599999999999
}
```

---

## Checklist Pos-Implementacao

- [ ] Envio de boleto PDF funciona em CobrancasList
- [ ] Envio de boleto PDF funciona em CobrancaDetalhe
- [ ] Envio em lote de boletos com delay entre mensagens
- [ ] Envio de contrato PDF funciona em Contratos
- [ ] IA pode enviar boleto PDF quando solicitado
- [ ] Parametros mediatype, mimetype, fileName corretos
- [ ] Caption/legenda sendo enviada
- [ ] Erros logados na tabela whatsapp_logs
- [ ] Status atualizado em whatsapp_mensagens

---

## Teste Recomendado: Envio de Boleto PDF

### Pre-requisitos

1. WhatsApp conectado via QR Code
2. Cobranca com `boleto_url` valida (gerado pelo ASAAS)
3. Associado com telefone cadastrado

### Passos do Teste

1. Acessar Financeiro > Cobrancas
2. Localizar cobranca com boleto gerado
3. Clicar em Acoes > Enviar WhatsApp (PDF)
4. Aguardar toast de sucesso
5. Verificar no WhatsApp do destinatario:
   - Arquivo PDF recebido
   - Caption/legenda visivel
   - PDF abre corretamente

### Resultado Esperado

- PDF chega como documento no WhatsApp
- Nome do arquivo: `boleto_xxx.pdf`
- Legenda com valor e vencimento
- Registro criado em `whatsapp_mensagens` com tipo `document`
