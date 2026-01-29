

# Revisao Completa - Gestao de Conversas e Historico na Evolution API

## Resumo Executivo

| Funcionalidade | Status | Implementacao Atual |
|----------------|--------|---------------------|
| POST /chat/findMessages/{instanceName} | **NAO IMPLEMENTADO** | Nenhum endpoint ou funcao chama este recurso |
| POST /chat/findChats/{instanceName} | **NAO IMPLEMENTADO** | Nenhum endpoint ou funcao chama este recurso |
| Historico exibido na ficha do cliente | **NAO IMPLEMENTADO** | Fichas de Lead e Associado nao mostram conversas WhatsApp |
| Mensagens antigas carregadas | **PARCIAL** | Armazenadas em `whatsapp_mensagens`, mas nao exibidas em UI |
| Busca por conversas | **NAO IMPLEMENTADO** | Sem interface para buscar/listar conversas |
| Historico persiste apos reconexao | **PARCIAL** | Mensagens salvas no banco, mas nao sincronizadas da Evolution API |

---

## Analise Detalhada

### 1. Endpoints da Evolution API - NAO UTILIZADOS

**POST /chat/findMessages/{instanceName}**

Este endpoint permite buscar historico de mensagens de uma conversa especifica. Parametros aceitos:

```json
{
  "where": {
    "key": {
      "remoteJid": "5521999999999@s.whatsapp.net"
    }
  }
}
```

**Uso esperado no sistema:**
- Quando atendente abre ficha do lead/associado
- Quando precisa consultar historico de atendimento
- Para auditoria de comunicacao

**Status:** NAO existe nenhuma funcao ou componente que chame este endpoint.

---

**POST /chat/findChats/{instanceName}**

Este endpoint lista todas as conversas da instancia WhatsApp.

**Uso esperado no sistema:**
- Sincronizar conversas existentes
- Buscar conversas nao vinculadas a leads/associados
- Identificar contatos que ainda nao tem cadastro

**Status:** NAO existe nenhuma funcao ou componente que chame este endpoint.

---

### 2. Armazenamento Local - PARCIAL

**Tabela `whatsapp_mensagens`:**

A tabela existe e armazena mensagens enviadas/recebidas:

| Coluna | Tipo | Uso |
|--------|------|-----|
| id | uuid | PK |
| telefone | varchar | Numero do contato (com DDI) |
| nome_contato | varchar | Nome se disponivel |
| tipo | varchar | text, image, document, audio |
| mensagem | text | Conteudo da mensagem |
| direcao | varchar | 'entrada' ou 'saida' |
| status | varchar | enviada, entregue, lida, erro |
| created_at | timestamp | Data/hora |

**Indices existentes:**
- `idx_wpp_msg_telefone` - Busca por telefone
- `idx_wpp_msg_created` - Ordenacao por data
- `idx_wpp_msg_referencia` - Vinculacao a entidades

**Dados atuais:** 4 mensagens nos ultimos 7 dias (sistema em testes).

**Gap principal:** As mensagens sao salvas quando enviadas/recebidas pelo sistema, mas NAO ha sincronizacao de historico pre-existente da Evolution API.

---

### 3. Interface de Usuario - NAO IMPLEMENTADO

**Ficha do Lead (`LeadDetalhe.tsx`):**
- Mostra historico de acoes do funil (mudancas de etapa, cotacoes)
- NAO mostra conversas WhatsApp
- Botao "WhatsApp" apenas abre link externo wa.me

**Ficha do Associado (`AssociadoDetalhe.tsx`):**
- Mostra historico de eventos (boletos, sinistros, documentos)
- NAO mostra conversas WhatsApp
- Botao "WhatsApp" apenas abre link externo wa.me

**Componentes existentes que poderiam ser adaptados:**
- `TimelineContatos.tsx` - Timeline de contatos no modulo de cobranca (ligacao, whatsapp, sms)
- `ConversaIADialog.tsx` - Modal para visualizar conversas do chat IA
- `InteracaoTimeline.tsx` - Timeline de interacoes na ouvidoria

---

### 4. Fluxo Atual de Mensagens

```text
MENSAGEM ENVIADA (sistema -> associado):
1. Edge Function (whatsapp-send-text, disparar-notificacao, etc.)
2. Chama Evolution API: POST /message/sendText/{instanceName}
3. Salva em whatsapp_mensagens com direcao='saida'

MENSAGEM RECEBIDA (associado -> sistema):
1. Evolution API envia webhook para whatsapp-webhook
2. Processa mensagem (IA, vinculacao de documentos, etc.)
3. Salva em whatsapp_mensagens com direcao='entrada'
4. Envia resposta se necessario
```

**Gap:** NAO ha sincronizacao de mensagens antigas. Se a instancia for reconectada, o historico anterior na Evolution API nao e importado.

---

## Plano de Implementacao

### Fase 1: Criar Edge Function para Buscar Historico

**Criar:** `supabase/functions/whatsapp-find-messages/index.ts`

```typescript
// Endpoint para buscar historico de mensagens de um contato
serve(async (req) => {
  const { telefone, limit = 50 } = await req.json();
  
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  
  // Buscar instancia principal
  const { data: instancia } = await supabase
    .from("whatsapp_instancias")
    .select("api_url, instance_name")
    .eq("principal", true)
    .single();
  
  // Formatar JID do WhatsApp
  const jid = `${telefone.replace(/\D/g, '')}@s.whatsapp.net`;
  
  // Chamar Evolution API
  const response = await fetch(
    `${instancia.api_url}/chat/findMessages/${instancia.instance_name}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        where: {
          key: { remoteJid: jid },
        },
      }),
    }
  );
  
  const mensagens = await response.json();
  
  // Opcionalmente sincronizar com banco local
  // ...
  
  return mensagens;
});
```

### Fase 2: Criar Edge Function para Listar Conversas

**Criar:** `supabase/functions/whatsapp-find-chats/index.ts`

```typescript
// Endpoint para listar todas as conversas
serve(async (req) => {
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  
  const { data: instancia } = await supabase
    .from("whatsapp_instancias")
    .select("api_url, instance_name")
    .eq("principal", true)
    .single();
  
  const response = await fetch(
    `${instancia.api_url}/chat/findChats/${instancia.instance_name}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({}),
    }
  );
  
  const chats = await response.json();
  
  // Enriquecer com dados de leads/associados
  // ...
  
  return chats;
});
```

### Fase 3: Criar Hook para Buscar Mensagens do Cliente

**Criar:** `src/hooks/useWhatsAppHistorico.ts`

```typescript
export function useWhatsAppHistorico(telefone: string | null) {
  return useQuery({
    queryKey: ['whatsapp-historico', telefone],
    queryFn: async () => {
      if (!telefone) return [];
      
      // Primeiro buscar do banco local
      const { data: mensagensLocais } = await supabase
        .from('whatsapp_mensagens')
        .select('*')
        .or(`telefone.eq.${telefone},telefone.eq.55${telefone}`)
        .order('created_at', { ascending: true })
        .limit(100);
      
      return mensagensLocais;
    },
    enabled: !!telefone,
  });
}

export function useSincronizarHistorico() {
  return useMutation({
    mutationFn: async (telefone: string) => {
      const { data } = await supabase.functions.invoke('whatsapp-find-messages', {
        body: { telefone, limit: 100 },
      });
      return data;
    },
  });
}
```

### Fase 4: Criar Componente de Timeline WhatsApp

**Criar:** `src/components/whatsapp/HistoricoConversaWhatsApp.tsx`

```typescript
interface Props {
  telefone: string;
}

export function HistoricoConversaWhatsApp({ telefone }: Props) {
  const { data: mensagens, isLoading } = useWhatsAppHistorico(telefone);
  const sincronizar = useSincronizarHistorico();
  
  return (
    <Card>
      <CardHeader className="flex-row justify-between items-center">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" />
          Conversas WhatsApp
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => sincronizar.mutate(telefone)}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Sincronizar
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {mensagens?.map((msg) => (
            <div 
              key={msg.id}
              className={cn(
                "mb-3 p-3 rounded-lg max-w-[80%]",
                msg.direcao === 'entrada' 
                  ? "bg-muted mr-auto" 
                  : "bg-green-100 ml-auto"
              )}
            >
              <p className="text-sm">{msg.mensagem}</p>
              <span className="text-xs text-muted-foreground">
                {format(new Date(msg.created_at), "dd/MM HH:mm")}
              </span>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

### Fase 5: Integrar na Ficha do Associado

**Modificar:** `src/pages/cadastro/AssociadoDetalhe.tsx`

Adicionar nova aba ou secao para historico WhatsApp:

```typescript
// Nas tabs existentes
<TabsTrigger value="whatsapp">
  <MessageCircle className="h-4 w-4 mr-2" />
  WhatsApp
</TabsTrigger>

// Conteudo da tab
<TabsContent value="whatsapp">
  <HistoricoConversaWhatsApp 
    telefone={associado.whatsapp || associado.telefone} 
  />
</TabsContent>
```

### Fase 6: Integrar na Ficha do Lead

**Modificar:** `src/pages/vendas/LeadDetalhe.tsx`

Similar ao associado, adicionar componente de historico:

```typescript
{/* Apos secao de cotacoes */}
<Card className="shadow-sm">
  <CardHeader className="pb-4 bg-muted/50 rounded-t-lg border-b">
    <CardTitle className="flex items-center gap-2 text-lg">
      <MessageCircle className="h-5 w-5 text-green-600" />
      Conversas WhatsApp
    </CardTitle>
  </CardHeader>
  <CardContent>
    <HistoricoConversaWhatsApp telefone={lead.telefone} />
  </CardContent>
</Card>
```

### Fase 7: Sincronizar Historico ao Reconectar

**Modificar:** `src/hooks/useWhatsAppStatus.ts`

Quando status muda para 'open', sincronizar historico recente:

```typescript
useEffect(() => {
  if (previousStatus !== 'open' && status === 'open') {
    // WhatsApp acabou de conectar - sincronizar conversas recentes
    supabase.functions.invoke('whatsapp-find-chats', {
      body: { sincronizar: true },
    });
  }
}, [status, previousStatus]);
```

### Fase 8: Criar Pagina de Conversas Nao Vinculadas

**Criar:** `src/pages/integracao/ConversasWhatsApp.tsx`

Pagina para visualizar todas as conversas e vincular a leads/associados:

- Listar conversas ativas
- Indicar quais estao vinculadas a cadastros
- Permitir vincular manualmente
- Mostrar mensagens recentes de cada conversa

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/whatsapp-find-messages/index.ts` | Buscar historico de mensagens via Evolution API |
| `supabase/functions/whatsapp-find-chats/index.ts` | Listar conversas via Evolution API |
| `src/hooks/useWhatsAppHistorico.ts` | Hook para buscar/sincronizar historico |
| `src/components/whatsapp/HistoricoConversaWhatsApp.tsx` | Componente de timeline de conversas |
| `src/pages/integracao/ConversasWhatsApp.tsx` | Pagina de gestao de conversas |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Adicionar tab/secao de WhatsApp |
| `src/pages/vendas/LeadDetalhe.tsx` | Adicionar secao de WhatsApp |
| `src/hooks/useWhatsAppStatus.ts` | Sincronizar ao reconectar |
| `supabase/config.toml` | Adicionar novas functions |
| `src/App.tsx` | Adicionar rota de conversas |

---

## Fluxo Proposto

```text
ABERTURA DA FICHA DO CLIENTE:
1. Carregar dados do lead/associado
2. Buscar mensagens em whatsapp_mensagens pelo telefone
3. Exibir timeline de conversas na ficha

SINCRONIZACAO MANUAL:
1. Usuario clica "Sincronizar"
2. Chama whatsapp-find-messages com telefone
3. Evolution API retorna historico
4. Salva mensagens novas em whatsapp_mensagens
5. Atualiza timeline na tela

RECONEXAO DO WHATSAPP:
1. Status muda para 'open'
2. Automaticamente chama whatsapp-find-chats
3. Identifica conversas recentes
4. Sincroniza mensagens dos ultimos 7 dias
5. Mensagens ficam disponiveis nas fichas

AUDITORIA:
1. Acessar Integracoes > Conversas WhatsApp
2. Visualizar todas as conversas da instancia
3. Filtrar por periodo, status, vinculacao
4. Exportar conversas se necessario
```

---

## Consideracoes Tecnicas

### Limites da Evolution API

- Endpoint `findMessages` pode retornar muitas mensagens
- Recomendado usar paginacao/limite (ex: ultimas 100)
- Mensagens antigas podem nao estar disponiveis se a sessao foi encerrada

### Performance

- Indice `idx_wpp_msg_telefone` ja existe para busca por telefone
- Considerar cache das mensagens mais recentes
- Paginacao na UI para conversas longas

### Privacidade

- Mensagens podem conter dados sensiveis
- Acesso deve ser restrito a usuarios autorizados (diretor, analista)
- Log de auditoria para consultas de historico

---

## Checklist Pos-Implementacao

- [ ] Atendente consegue ver historico WhatsApp na ficha do lead
- [ ] Atendente consegue ver historico WhatsApp na ficha do associado
- [ ] Botao de sincronizar busca mensagens da Evolution API
- [ ] Mensagens antigas sao exibidas corretamente
- [ ] Historico persiste apos reconexao do WhatsApp
- [ ] Pagina de conversas lista todos os chats ativos
- [ ] Conversas nao vinculadas podem ser identificadas
- [ ] Auditoria de comunicacao disponivel

