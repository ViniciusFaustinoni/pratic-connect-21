
# Revisao Completa - Fluxo de Conexao e Monitoramento de Status Evolution API

## Resumo Executivo

| Cenario | Status | Detalhes |
|---------|--------|----------|
| GET /instance/connect chamado ao acessar tela | **PARCIAL** | So e chamado quando usuario clica em "Conectar" |
| GET /instance/connect para reconexao | **PARCIAL** | Depende de acao manual do usuario |
| GET /instance/connect para exibir QR Code | **IMPLEMENTADO** | `whatsapp-qrcode` chama `/instance/connect/{name}` |
| GET /connectionState antes de enviar mensagem | **PARCIAL** | `whatsapp-send-media` verifica status LOCAL, nao chama API |
| GET /connectionState no dashboard | **NAO IMPLEMENTADO** | Dashboard usa query local, nao status real-time |
| GET /connectionState em timeout de envio | **NAO IMPLEMENTADO** | Nao ha tratamento especifico de timeout |
| GET /connectionState periodico | **IMPLEMENTADO** | Hook `useWhatsAppStatus` chama a cada 30s |
| QR Code exibido corretamente | **IMPLEMENTADO** | Modal exibe QR Code com polling de 5s |
| Status "open" verificado antes de enviar | **PARCIAL** | `whatsapp-send-media` verifica, mas `whatsapp-send-text` NAO verifica |
| Desconexoes detectadas e alertadas | **NAO IMPLEMENTADO** | Webhook recebe CONNECTION_UPDATE mas NAO processa |
| Reconexao automatica tentada | **NAO IMPLEMENTADO** | Nao existe logica de auto-reconnect |

---

## Analise Detalhada

### 1. GET /instance/connect/{instanceName}

#### Quando Administrador Acessa Tela de Configuracao

**STATUS: NAO IMPLEMENTADO**

Ao acessar a tela de WhatsApp (`WhatsAppStatusCard`), o sistema apenas chama `whatsapp-status` para verificar o estado:

```typescript
// useWhatsAppStatus.ts (linhas 10-25)
const statusQuery = useQuery({
  queryKey: ['whatsapp-status', instanciaId],
  queryFn: async () => {
    const { data, error } = await supabase.functions.invoke('whatsapp-status', {
      body: { instancia_id: instanciaId },
    });
    return data;
  },
  refetchInterval: 30000, // Verifica a cada 30s
});
```

O `whatsapp-status` chama `GET /instance/connectionState`, NAO `/instance/connect`. A conexao so e iniciada quando o usuario clica em "Conectar".

#### Quando Ha Necessidade de Reconectar

**STATUS: PARCIAL**

O usuario precisa clicar manualmente em "Conectar" para reescanear QR Code. Nao ha tentativa automatica de reconexao.

#### Quando QR Code Precisa Ser Exibido

**STATUS: IMPLEMENTADO**

O `whatsapp-qrcode` implementa corretamente:

```typescript
// whatsapp-qrcode/index.ts (linhas 135-142)
const response = await fetch(
  `${instancia.api_url}/instance/connect/${instancia.instance_name}`,
  {
    method: 'GET',
    headers: { 'apikey': apiKey }
  }
);
```

---

### 2. GET /instance/connectionState/{instanceName}

#### Antes de Enviar Mensagem

**STATUS: PARCIAL**

| Edge Function | Verifica Status? | Tipo de Verificacao |
|---------------|------------------|---------------------|
| `whatsapp-send-media` | SIM | Status LOCAL (`instancia.status !== 'open'`) |
| `whatsapp-send-text` | NAO | Nao verifica nada antes de enviar |

**Problema em `whatsapp-send-text`:**
```typescript
// whatsapp-send-text/index.ts (linhas 29-46)
// Buscar instância - NAO VERIFICA STATUS!
let query = supabase.from("whatsapp_instancias").select("id, api_url, instance_name");

if (instancia_id) {
  query = query.eq("id", instancia_id);
} else {
  query = query.eq("principal", true);
}

const { data: instancia } = await query.single();
// Envia direto sem verificar se esta conectado!
```

**Problema em `whatsapp-send-media`:**
```typescript
// whatsapp-send-media/index.ts (linhas 87-89)
if (instancia.status !== 'open') {
  throw new Error('WhatsApp não está conectado');
}
// Verifica status LOCAL (campo `status` do banco)
// NAO chama /connectionState para verificar status REAL na API
```

#### No Dashboard de Monitoramento

**STATUS: NAO IMPLEMENTADO**

O `IntegracoesStatusCard` no dashboard NAO verifica status real do WhatsApp:

```typescript
// IntegracoesStatusCard.tsx (linhas 43-54)
const { data: evolutionConfig } = useQuery({
  queryKey: ['evolution-config-status'],
  queryFn: async () => {
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'evolution_api_key')
      .maybeSingle();
    return data?.valor ? true : false; // Apenas verifica se API KEY existe!
  },
});
```

Deveria usar o hook `useWhatsAppStatus` para mostrar status real.

#### Em Timeout de Envio de Mensagem

**STATUS: NAO IMPLEMENTADO**

Nao ha tratamento especifico de timeout. Se a Evolution API nao responder, o erro e generico.

#### Periodicamente para Verificar Saude da Conexao

**STATUS: IMPLEMENTADO**

O hook `useWhatsAppStatus` faz polling a cada 30 segundos:

```typescript
const statusQuery = useQuery({
  refetchInterval: 30000, // Verificar a cada 30s
  staleTime: 10000,
});
```

Porem, este polling so ocorre quando o componente `WhatsAppStatusCard` esta renderizado (tela de configuracao aberta).

---

### 3. Verificacao de Desconexoes

**STATUS: NAO IMPLEMENTADO**

O webhook esta configurado para receber `CONNECTION_UPDATE`, mas NAO processa este evento:

```typescript
// whatsapp-webhook/index.ts (linhas 830-833)
// Ignorar eventos que não são mensagens
if (payload.event !== "messages.upsert") {
  return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: corsHeaders });
}
```

Quando o WhatsApp desconecta do celular:
1. Evolution API envia evento `CONNECTION_UPDATE`
2. Webhook recebe mas IGNORA o evento
3. Status no banco permanece "open"
4. Sistema continua tentando enviar mensagens que falham
5. Nenhum alerta e gerado

---

### 4. Reconexao Automatica

**STATUS: NAO IMPLEMENTADO**

Nao existe nenhuma logica para:
- Detectar desconexao e alertar administrador
- Tentar reconexao automatica
- Limitar tentativas de reconexao
- Notificar diretores sobre problemas de conexao

---

## Gaps Identificados

### Gap 1: Webhook NAO Processa CONNECTION_UPDATE

O evento mais importante para monitoramento esta sendo ignorado. Deveria:
- Detectar quando status muda para `close` ou `disconnected`
- Atualizar status no banco imediatamente
- Criar alerta para administradores

### Gap 2: whatsapp-send-text NAO Verifica Status

Mensagens de texto podem ser enviadas para instancia desconectada, causando erros silenciosos.

### Gap 3: Dashboard NAO Mostra Status Real

O card de integracoes mostra apenas se a API key existe, nao se o WhatsApp esta conectado.

### Gap 4: NAO Ha Alertas de Desconexao

Quando WhatsApp desconecta, administradores nao sao notificados.

### Gap 5: NAO Ha Reconexao Automatica

O sistema depende de acao manual para reconectar.

---

## Plano de Implementacao

### Fase 1: Processar CONNECTION_UPDATE no Webhook

**Modificar:** `supabase/functions/whatsapp-webhook/index.ts`

Adicionar handler para eventos de conexao:

```typescript
// Antes de ignorar eventos que não são mensagens
if (payload.event === "connection.update") {
  const state = payload.data?.state;
  console.log(`[whatsapp-webhook] CONNECTION_UPDATE: ${state}`);
  
  // Atualizar status no banco
  const novoStatus = state === 'open' ? 'open' : 'disconnected';
  
  await supabase
    .from('whatsapp_instancias')
    .update({
      status: novoStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('principal', true);
  
  // Se desconectou, criar alerta
  if (novoStatus === 'disconnected') {
    await supabase
      .from('notificacoes')
      .insert({
        titulo: 'WhatsApp Desconectado',
        mensagem: 'A conexao do WhatsApp foi perdida. Acesse Configuracoes > Integracoes para reconectar.',
        tipo: 'erro',
        destinatario_role: 'diretor',
      });
  }
  
  return new Response(JSON.stringify({ ok: true, status: novoStatus }), { headers: corsHeaders });
}
```

### Fase 2: Adicionar Verificacao de Status em whatsapp-send-text

**Modificar:** `supabase/functions/whatsapp-send-text/index.ts`

Adicionar verificacao de status antes de enviar:

```typescript
// Apos buscar instancia
const { data: instancia } = await query.single();

// NOVO: Verificar se WhatsApp está conectado
if (!instancia.status || instancia.status !== 'open') {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: "WhatsApp não está conectado. Acesse as configurações para reconectar." 
    }),
    { status: 503, headers: corsHeaders }
  );
}
```

### Fase 3: Atualizar Dashboard com Status Real do WhatsApp

**Modificar:** `src/components/diretoria/IntegracoesStatusCard.tsx`

Usar hook `useWhatsAppStatus` para mostrar status real:

```typescript
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';

// Dentro do componente
const { connected, status } = useWhatsAppStatus();

// Na lista de integracoes
{
  nome: 'WhatsApp (Evolution API)',
  slug: 'whatsapp',
  icone: <MessageCircle className="h-5 w-5" />,
  status: connected ? 'conectado' : 'desconectado',
  descricao: status === 'connecting' ? 'Conectando...' : 'Comunicação via WhatsApp',
}
```

### Fase 4: Verificar Status Real (API) Antes de Enviar Mensagens Criticas

**Modificar:** `supabase/functions/whatsapp-send-media/index.ts`

Adicionar verificacao dupla (banco + API) para mensagens importantes:

```typescript
// Verificação LOCAL (rápida)
if (instancia.status !== 'open') {
  throw new Error('WhatsApp não está conectado');
}

// NOVO: Verificação REAL na API para mensagens críticas
// (opcional, ativado por parametro)
if (payload.verificar_conexao_real) {
  const statusResponse = await fetch(
    `${instancia.api_url}/instance/connectionState/${instancia.instance_name}`,
    { method: 'GET', headers: { 'apikey': apiKey } }
  );
  
  const statusData = await statusResponse.json();
  if (statusData.instance?.state !== 'open') {
    // Atualizar banco com status real
    await supabase.from('whatsapp_instancias').update({ status: 'disconnected' }).eq('id', instancia.id);
    throw new Error('WhatsApp desconectou. Reconecte para continuar enviando mensagens.');
  }
}
```

### Fase 5: Criar Componente de Alerta Global de WhatsApp

**Novo arquivo:** `src/components/global/WhatsAppConnectionAlert.tsx`

Exibir banner de alerta quando WhatsApp esta desconectado:

```typescript
export function WhatsAppConnectionAlert() {
  const { connected, status } = useWhatsAppStatus();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  
  // Mostrar apenas para diretores
  if (profile?.role !== 'diretor' || connected) {
    return null;
  }
  
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>WhatsApp Desconectado</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>A conexao do WhatsApp foi perdida. Mensagens nao serao enviadas.</span>
        <Button size="sm" onClick={() => navigate('/configuracoes/integracoes')}>
          Reconectar
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/whatsapp-webhook/index.ts` | Processar evento CONNECTION_UPDATE |
| `supabase/functions/whatsapp-send-text/index.ts` | Adicionar verificacao de status |
| `supabase/functions/whatsapp-send-media/index.ts` | Adicionar verificacao real opcional |
| `src/components/diretoria/IntegracoesStatusCard.tsx` | Usar hook useWhatsAppStatus |

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/global/WhatsAppConnectionAlert.tsx` | Banner de alerta global |

---

## Checklist de Verificacao Pos-Implementacao

- [x] GET /instance/connect chamado para gerar QR Code
- [ ] GET /instance/connect chamado automaticamente ao detectar desconexao
- [x] GET /connectionState chamado periodicamente (polling 30s)
- [ ] GET /connectionState verificado antes de enviar QUALQUER mensagem
- [ ] Dashboard mostra status REAL do WhatsApp (nao apenas se API key existe)
- [ ] Evento CONNECTION_UPDATE processado no webhook
- [ ] Alerta criado quando conexao e perdida
- [ ] Administradores notificados sobre desconexao
- [ ] Banner global exibido quando WhatsApp desconectado
- [ ] Reconexao automatica tentada (ou orientacao clara para reconectar)

---

## Teste Recomendado: Desconexao do WhatsApp

### Pre-requisitos

1. WhatsApp conectado via QR Code
2. Acesso ao celular com WhatsApp vinculado
3. Acesso como diretor no sistema

### Passos do Teste

**Parte 1: Verificar Estado Inicial**

1. Acessar Configuracoes > Integracoes > WhatsApp
2. Confirmar que status e "Conectado"
3. Enviar mensagem de teste para um numero

**Parte 2: Simular Desconexao**

4. No celular, acessar WhatsApp > Aparelhos conectados
5. Desconectar o dispositivo "SGA-PRATIC"
6. Aguardar 30 segundos (polling do status)

**Parte 3: Verificar Deteccao**

7. Na tela de configuracoes, verificar que status mudou para "Desconectado"
8. Verificar que banner de alerta aparece (apos implementacao)
9. Verificar que notificacao foi criada para diretores
10. Tentar enviar mensagem e confirmar que erro e tratado corretamente

**Parte 4: Reconectar**

11. Clicar em "Conectar"
12. Escanear QR Code novamente
13. Confirmar que status volta para "Conectado"
14. Enviar mensagem de teste e confirmar sucesso

### Resultado Esperado

- Desconexao detectada automaticamente via webhook ou polling
- Status atualizado no banco imediatamente
- Alerta visual para administradores
- Mensagens NAO sao enviadas quando desconectado
- Reconexao via QR Code funciona sem problemas

---

## Diagrama do Fluxo de Monitoramento

```text
+-------------------+     +------------------+     +-------------------+
|   WhatsApp App    |     |   Evolution API  |     |   Supabase Edge   |
|   (Celular)       |     |                  |     |   Functions       |
+--------+----------+     +--------+---------+     +---------+---------+
         |                         |                         |
         | Desconecta              |                         |
         +------------------------>|                         |
         |                         |                         |
         |                         | CONNECTION_UPDATE       |
         |                         | (event: "close")        |
         |                         +------------------------>|
         |                         |                         |
         |                         |       whatsapp-webhook  |
         |                         |       processa evento   |
         |                         |                         |
         |                         |                         v
         |                         |               +---------+---------+
         |                         |               |   Supabase DB     |
         |                         |               |                   |
         |                         |               | UPDATE instancias |
         |                         |               | status='disconn'  |
         |                         |               |                   |
         |                         |               | INSERT notificacao|
         |                         |               | 'WhatsApp desc.'  |
         |                         |               +---------+---------+
         |                         |                         |
         |                         |                         v
         |                         |               +---------+---------+
         |                         |               |   Frontend React  |
         |                         |               |                   |
         |                         |               | Query invalida    |
         |                         |               | Status badge: OFF |
         |                         |               | Alert banner: ON  |
         |                         |               +-------------------+
```
