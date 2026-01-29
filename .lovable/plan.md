
# Revisao Completa - Sistema de Criacao e Gerenciamento de Instancia Evolution API

## Resumo Executivo

| Cenario | Status | Detalhes |
|---------|--------|----------|
| POST /instance/create na inicializacao | **PARCIAL** | Nao ha criacao automatica na primeira execucao; criacao ocorre apenas via QR Code |
| POST /instance/create para novo numero | **NAO IMPLEMENTADO** | Sistema suporta apenas 1 instancia principal; nao ha UI para multiplas instancias |
| POST /instance/create apos deletar instancia | **IMPLEMENTADO** | `whatsapp-qrcode` verifica e recria se instancia nao existe na Evolution |
| POST /instance/create na migracao de numero | **NAO IMPLEMENTADO** | Nao existe funcionalidade de migracao de numero |
| instanceName definido corretamente | **SIM** | Campo `instance_name` da tabela usado no payload |
| qrcode habilitado | **SIM** | Parametro `qrcode: true` enviado |
| integration WHATSAPP-BAILEYS | **SIM** | Parametro `integration: 'WHATSAPP-BAILEYS'` enviado |
| Webhook configurado na criacao | **NAO** | Webhook configurado separadamente apos conexao |

---

## Analise Detalhada

### 1. Quando o Sistema e Inicializado pela Primeira Vez

**STATUS: NAO IMPLEMENTADO**

Nao existe trigger automatico para criar instancia na Evolution API quando o sistema e instalado. O fluxo atual:

1. Diretor acessa Configuracoes > Integracoes > WhatsApp
2. Insere URL da Evolution API manualmente em `ConfiguracaoEvolutionURL.tsx`
3. Sistema salva registro em `whatsapp_instancias` (banco local apenas)
4. Instancia na Evolution API **NAO e criada** neste momento
5. Instancia so e criada quando usuario clica em "Conectar" (QR Code)

**Evidencia no Banco:**
```sql
-- Instancia existe localmente mas pode nao existir na Evolution API
id: b0c104d5-48fe-47a8-b03c-d305c2512ed2
instance_name: sga-pratic
api_url: https://evolution.praticcar.org
status: open
```

---

### 2. Quando Ha Necessidade de Criar Nova Instancia para Outro Numero

**STATUS: NAO IMPLEMENTADO**

O sistema atual suporta **apenas 1 instancia principal**:

```typescript
// ConfiguracaoEvolutionURL.tsx (linha 82-86)
const { data: existente } = await supabase
  .from('whatsapp_instancias')
  .select('id')
  .eq('principal', true)  // <- Sempre busca a principal
  .maybeSingle();
```

**Gaps:**
- Nao existe UI para criar instancias adicionais
- Nao existe funcionalidade para gerenciar multiplos numeros
- Constraint `idx_whatsapp_principal` garante apenas 1 principal

---

### 3. Quando Instancia Foi Deletada e Precisa Ser Recriada

**STATUS: IMPLEMENTADO**

O arquivo `whatsapp-qrcode/index.ts` implementa esta logica corretamente:

```typescript
// whatsapp-qrcode/index.ts (linhas 50-84)
// Primeiro, verificar se a instância existe na Evolution API
const checkResponse = await fetch(
  `${instancia.api_url}/instance/fetchInstances`,
  {
    method: 'GET',
    headers: { 'apikey': apiKey }
  }
);

let instanceExists = false;
if (checkResponse.ok) {
  const instances = await checkResponse.json();
  instanceExists = Array.isArray(instances) && 
    instances.some((i: { name?: string }) => i.name === instancia.instance_name);
}

// Se não existe, criar a instância
if (!instanceExists) {
  console.log('Criando instância:', instancia.instance_name);
  
  const createResponse = await fetch(
    `${instancia.api_url}/instance/create`,
    {
      method: 'POST',
      headers: { 
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instanceName: instancia.instance_name,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      })
    }
  );
  // ...
}
```

**Fluxo:**
1. Usuario clica "Conectar" no `WhatsAppStatusCard`
2. Sistema chama `whatsapp-qrcode`
3. Edge function verifica via `GET /instance/fetchInstances`
4. Se nao encontrar a instancia, chama `POST /instance/create`
5. QR Code e retornado para conexao

---

### 4. Quando Ha Migracao de Numero de WhatsApp

**STATUS: NAO IMPLEMENTADO**

Nao existe funcionalidade para:
- Migrar numero de um celular para outro
- Trocar o numero associado a instancia
- Processo de "logout + novo login" guiado

O processo atual para trocar numero seria manual:
1. Desconectar via `whatsapp-logout`
2. Escanear QR Code com novo celular
3. Conexao estabelecida com novo numero

**Problema:** O sistema nao oferece UI orientada para este fluxo.

---

## Verificacao dos Parametros de Criacao

### instanceName

**STATUS: CORRETO**

```typescript
// whatsapp-qrcode/index.ts
body: JSON.stringify({
  instanceName: instancia.instance_name,  // <- Do banco de dados
  // ...
})
```

O campo `instance_name` e definido na configuracao inicial e armazenado na tabela `whatsapp_instancias`. Valor atual: `sga-pratic`.

### qrcode

**STATUS: CORRETO**

```typescript
body: JSON.stringify({
  // ...
  qrcode: true,  // <- Habilitado
  // ...
})
```

### integration

**STATUS: CORRETO**

```typescript
body: JSON.stringify({
  // ...
  integration: 'WHATSAPP-BAILEYS',  // <- Tipo correto
})
```

### Webhook na Criacao

**STATUS: NAO IMPLEMENTADO NA CRIACAO**

O webhook **NAO** e passado no payload de criacao da instancia:

```typescript
// Payload ATUAL de criação (whatsapp-qrcode/index.ts)
body: JSON.stringify({
  instanceName: instancia.instance_name,
  qrcode: true,
  integration: 'WHATSAPP-BAILEYS',
  // FALTA: webhook, events, etc.
})
```

**Como deveria ser:**
```typescript
body: JSON.stringify({
  instanceName: instancia.instance_name,
  qrcode: true,
  integration: 'WHATSAPP-BAILEYS',
  webhook: {
    url: WEBHOOK_URL,
    enabled: true,
    webhook_by_events: false,
    webhook_base64: false,
    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE']
  }
})
```

**Workaround Atual:**
O `whatsapp-status` configura o webhook automaticamente apos conexao (linhas 119-145):

```typescript
// Auto-configurar webhook quando conectar
if (novoStatus === 'open' && statusAnterior !== 'open' && !instancia.webhook_url) {
  const setWebhookResponse = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-set-webhook`,
    // ...
  );
}
```

---

## Gaps Identificados

### Gap 1: Webhook Nao Configurado na Criacao

O webhook e configurado apenas APOS a conexao, via `whatsapp-set-webhook`. Isso cria uma janela onde mensagens podem ser perdidas.

### Gap 2: Nao Existe Inicializacao Automatica

Quando o sistema e implantado, nao ha trigger para criar a instancia na Evolution API. Depende de acao manual.

### Gap 3: Suporte a Apenas 1 Instancia

O sistema assume apenas 1 numero de WhatsApp. Nao suporta multiplas linhas.

### Gap 4: Nao Existe Fluxo de Migracao

Trocar de numero requer processo manual nao documentado.

### Gap 5: Logout Nao Deleta Instancia

O `whatsapp-logout` usa `DELETE /instance/logout` que desconecta, mas mantem a instancia na Evolution API. Para recriar completamente, precisaria de `DELETE /instance/delete`.

---

## Plano de Implementacao

### Fase 1: Incluir Webhook na Criacao da Instancia

**Modificar:** `supabase/functions/whatsapp-qrcode/index.ts`

Adicionar configuracao de webhook no payload de criacao:

```typescript
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

// Na criacao da instancia
const createResponse = await fetch(
  `${instancia.api_url}/instance/create`,
  {
    method: 'POST',
    headers: { 
      'apikey': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      instanceName: instancia.instance_name,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhook: {
        url: WEBHOOK_URL,
        enabled: true,
        webhook_by_events: false,
        webhook_base64: false,
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE']
      }
    })
  }
);
```

### Fase 2: Adicionar Botao para Recriar Instancia

**Modificar:** `src/components/whatsapp/WhatsAppStatusCard.tsx`

Adicionar opcao para deletar e recriar instancia quando houver problemas:

```typescript
// Novo botão no menu de ações
<Button
  variant="outline"
  size="sm"
  onClick={handleRecriarInstancia}
>
  <Trash2 className="h-4 w-4 mr-2" />
  Recriar Instância
</Button>
```

### Fase 3: Criar Edge Function para Deletar Instancia

**Novo arquivo:** `supabase/functions/whatsapp-delete-instance/index.ts`

```typescript
// Deletar instância completamente da Evolution API
const response = await fetch(
  `${instancia.api_url}/instance/delete/${instancia.instance_name}`,
  {
    method: 'DELETE',
    headers: { 'apikey': apiKey }
  }
);

// Limpar dados locais
await supabase
  .from('whatsapp_instancias')
  .update({
    status: 'disconnected',
    telefone: null,
    webhook_url: null,
    webhook_enabled: false,
    // ...
  })
  .eq('id', instancia.id);
```

### Fase 4: Adicionar Validacao de Instancia na Inicializacao

**Modificar:** `src/components/whatsapp/WhatsAppStatusCard.tsx`

Verificar se instancia existe na Evolution ao carregar:

```typescript
useEffect(() => {
  async function verificarInstancia() {
    const { data } = await supabase.functions.invoke('whatsapp-status', {
      body: {}
    });
    
    // Se status 404, oferecer criar
    if (data?.status === 'disconnected' && !data?.raw) {
      setMostrarBotaoCriar(true);
    }
  }
  verificarInstancia();
}, []);
```

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/whatsapp-qrcode/index.ts` | Incluir webhook no payload de criacao |
| `src/components/whatsapp/WhatsAppStatusCard.tsx` | Adicionar botao "Recriar Instancia" |

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/whatsapp-delete-instance/index.ts` | Deletar instancia da Evolution API |

---

## Teste Recomendado: Criar Nova Instancia

### Pre-requisitos

1. Acesso a Evolution API configurada
2. `EVOLUTION_API_KEY` no secrets do Supabase
3. Celular com WhatsApp para escanear QR

### Passos do Teste

**Parte 1: Verificar Estado Atual**

1. Acessar sistema como diretor
2. Navegar para Configuracoes > Integracoes > WhatsApp
3. Verificar status atual da conexao
4. Consultar Evolution API via `GET /instance/fetchInstances`

**Parte 2: Testar Criacao**

5. Se instancia nao existe: Clicar em "Conectar"
6. Sistema deve chamar `POST /instance/create` automaticamente
7. QR Code deve aparecer
8. Escanear com WhatsApp
9. Verificar conexao estabelecida

**Parte 3: Validar na Evolution**

10. Chamar `GET /instance/fetchInstances` na Evolution API
11. Confirmar que instancia `sga-pratic` aparece na lista
12. Verificar status da instancia via `GET /instance/connectionState/sga-pratic`

### Resultado Esperado

- Instancia criada com `instanceName: sga-pratic`
- `qrcode: true` habilitado
- `integration: WHATSAPP-BAILEYS` definido
- Webhook configurado apos conexao
- Instancia visivel em `GET /instance/fetchInstances`

---

## Checklist de Verificacao Pos-Implementacao

- [x] `POST /instance/create` chamado quando instancia nao existe
- [x] `instanceName` usando valor do banco (`instance_name`)
- [x] `qrcode: true` habilitado para conexao inicial
- [x] `integration: 'WHATSAPP-BAILEYS'` definido corretamente
- [ ] Webhook configurado na criacao (atualmente apenas apos conexao)
- [x] Log de criacao registrado em `whatsapp_logs`
- [x] Status atualizado para `qrcode` apos criacao
- [ ] Funcionalidade de deletar/recriar instancia
- [ ] Suporte a multiplas instancias
- [ ] Fluxo de migracao de numero
