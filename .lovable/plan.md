

# Revisao Completa - Configuracao de Webhooks Softruck

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint de webhook SGA | NAO EXISTE | Nenhuma Edge Function para receber webhooks Softruck |
| Eventos DEVICES.ASSOCIATED | NAO IMPLEMENTADO | Nao ha handler para este evento |
| Eventos DEVICES.DISASSOCIATED | NAO IMPLEMENTADO | Nao ha handler para este evento |
| Eventos VEHICLES.CREATED | NAO IMPLEMENTADO | Nao ha handler para este evento |
| Eventos VEHICLES.DELETED | NAO IMPLEMENTADO | Nao ha handler para este evento |
| Eventos device-events | NAO IMPLEMENTADO | Nao ha handler para este evento |
| Flag suporta_webhooks | TRUE | Configurado no banco mas nao implementado |
| Tabela de logs webhook | NAO EXISTE | Nao ha tabela dedicada para webhooks Softruck |
| Notificacoes para analista | NAO IMPLEMENTADO | Nao ha fluxo de notificacao |
| Teste com evento simulado | NAO POSSIVEL | Sem endpoint para receber |

---

## Analise da Documentacao Softruck

Consultando a documentacao oficial `docs.apiary.softruck.com`, a API Softruck v2 suporta os seguintes webhooks:

### Eventos Disponiveis

| Categoria | Eventos | Descricao |
|-----------|---------|-----------|
| **service-orders-events** | Service order, Provider, Section, Custom fields, Completion, Acknowledgement | Eventos de ordens de servico |
| **device-events** | Device association | Eventos quando device e associado/desassociado |
| **vehicle-events** | Vehicles | Eventos de criacao/remocao de veiculos |

### Estrutura de Webhooks na API

Os webhooks Softruck seguem o padrao de **Event Subscriptions**:
- Configurados no painel Softruck ou via API
- Enviam payloads para uma URL callback
- Requerem resposta HTTP 200 para confirmar recebimento

---

## Situacao Atual no Sistema

### 1. Configuracao de Plataforma

```sql
SELECT plataforma, suporta_webhooks FROM rastreadores_config_plataformas 
WHERE plataforma = 'softruck';
-- Resultado: suporta_webhooks = true
```

A flag esta habilitada, mas nao ha implementacao correspondente.

### 2. Edge Functions Existentes

Nao existe nenhuma Edge Function para receber webhooks Softruck:
- `softruck-api` - apenas chamadas outbound
- `softruck-ativar-dispositivo` - apenas chamadas outbound
- `sync-rastreadores` - apenas polling

### 3. Tabelas de Log

A tabela `rastreadores_logs` existe mas nao e usada para webhooks:
- Campos: rastreador_id, plataforma, operacao, request, response, status
- Usada apenas para logs de sincronizacao e autenticacao

### 4. Webhooks Similares no Sistema

O sistema ja possui webhooks implementados para outras integracoes:
- `asaas-webhook` - Recebe eventos de pagamento do ASAAS
- `autentique-webhook` - Recebe eventos de assinatura do Autentique
- `leads-webhook` - Recebe leads via API
- `whatsapp-webhook` - Recebe mensagens do WhatsApp

---

## Plano de Implementacao

### Fase 1: Criar Tabela de Eventos Softruck

**Nova tabela: `softruck_eventos`**

```sql
CREATE TABLE softruck_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_tipo VARCHAR(100) NOT NULL,
  evento_acao VARCHAR(50),
  payload JSONB NOT NULL,
  device_id VARCHAR(50),
  vehicle_id VARCHAR(50),
  rastreador_id UUID REFERENCES rastreadores(id),
  veiculo_id UUID REFERENCES veiculos(id),
  processado BOOLEAN DEFAULT FALSE,
  processado_em TIMESTAMPTZ,
  erro_processamento TEXT,
  ip_origem VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_softruck_eventos_tipo ON softruck_eventos(evento_tipo);
CREATE INDEX idx_softruck_eventos_created ON softruck_eventos(created_at DESC);
CREATE INDEX idx_softruck_eventos_rastreador ON softruck_eventos(rastreador_id);
```

### Fase 2: Criar Edge Function de Webhook

**Novo arquivo: `supabase/functions/softruck-webhook/index.ts`**

```typescript
// Funcionalidades:
// - Validar origem do webhook (IP ou token)
// - Parsear payload conforme tipo de evento
// - Registrar na tabela softruck_eventos
// - Processar evento e atualizar entidades
// - Gerar alertas para eventos criticos
// - Notificar analistas quando necessario
```

### Fase 3: Handlers por Tipo de Evento

**DEVICES.ASSOCIATED** - Quando device e associado a veiculo:
```typescript
async function handleDeviceAssociated(payload) {
  // 1. Buscar rastreador pelo device_id
  // 2. Atualizar plataforma_veiculo_id no rastreador
  // 3. Registrar historico
  // 4. Notificar equipe se necessario
}
```

**DEVICES.DISASSOCIATED** - Quando device e removido:
```typescript
async function handleDeviceDisassociated(payload) {
  // 1. Buscar rastreador pelo device_id
  // 2. Limpar plataforma_veiculo_id
  // 3. Gerar alerta CRITICO (desinstalacao nao autorizada?)
  // 4. Notificar monitoramento IMEDIATAMENTE
}
```

**VEHICLES.CREATED** - Quando veiculo e criado:
```typescript
async function handleVehicleCreated(payload) {
  // 1. Verificar se existe veiculo local com mesma placa
  // 2. Atualizar id_plataforma_veiculo se encontrar
  // 3. Registrar log
}
```

**VEHICLES.DELETED** - Quando veiculo e removido:
```typescript
async function handleVehicleDeleted(payload) {
  // 1. Buscar veiculos com este id_plataforma
  // 2. Gerar alerta CRITICO
  // 3. Notificar equipe de operacoes
}
```

**device-events** - Eventos de status do device:
```typescript
async function handleDeviceEvent(payload) {
  // 1. Atualizar status do rastreador
  // 2. Registrar mudanca de status
  // 3. Alertar se status critico (offline, bateria baixa, etc)
}
```

### Fase 4: Sistema de Alertas

Para eventos criticos, gerar alertas automaticos:

| Evento | Severidade | Acao |
|--------|------------|------|
| DEVICES.DISASSOCIATED | CRITICA | Notificar monitoramento + push + email |
| VEHICLES.DELETED | ALTA | Notificar operacoes + registrar auditoria |
| device-events (offline) | MEDIA | Registrar + incluir em dashboard |
| device-events (bateria < 20%) | MEDIA | Notificar monitoramento |

### Fase 5: Log Completo de Webhooks

Todos os webhooks recebidos serao registrados:
1. Payload completo em JSONB
2. IP de origem
3. Timestamp
4. Status de processamento
5. Erro (se houver)

### Fase 6: Interface de Visualizacao

Adicionar na pagina de configuracao de plataformas:
- Card mostrando "Webhooks Softruck"
- Lista dos ultimos eventos recebidos
- Filtros por tipo de evento
- Status de processamento
- Botao para reprocessar eventos com erro

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/softruck-webhook/index.ts` | Edge Function para receber webhooks |
| `src/components/rastreadores/SoftruckWebhooksPanel.tsx` | Painel de visualizacao de eventos |
| `src/hooks/useSoftruckEventos.ts` | Hook para listar eventos |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/config.toml` | Adicionar config da nova edge function |
| `src/pages/monitoramento/ConfigPlataformas.tsx` | Adicionar painel de webhooks |

## SQL Migration

Criar tabela `softruck_eventos` com indices.

---

## Configuracao no Painel Softruck

Apos implementacao no SGA, sera necessario configurar no painel Softruck:

1. **Acessar**: Painel Softruck > Configuracoes > Webhooks
2. **URL do Webhook**: 
   ```
   https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/softruck-webhook
   ```
3. **Eventos a Assinar**:
   - [x] DEVICES.ASSOCIATED
   - [x] DEVICES.DISASSOCIATED
   - [x] VEHICLES.CREATED
   - [x] VEHICLES.DELETED
   - [x] device-events
4. **Autenticacao**: Configurar header `x-webhook-secret` (opcional)

---

## Estrutura do Webhook Endpoint

```
URL: https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/softruck-webhook

Metodo: POST

Headers:
- Content-Type: application/json
- x-webhook-secret: (opcional, para validacao)

Body (exemplo DEVICES.ASSOCIATED):
{
  "event": "DEVICES.ASSOCIATED",
  "timestamp": "2026-01-29T12:00:00Z",
  "data": {
    "device": {
      "id": "abc123",
      "imei": "123456789012345"
    },
    "vehicle": {
      "id": "xyz789",
      "plate": "ABC1234"
    }
  }
}

Response esperada:
- 200 OK: Evento processado
- 400 Bad Request: Payload invalido
- 401 Unauthorized: Token invalido
- 500 Internal Error: Erro de processamento
```

---

## Teste com Evento Simulado

Apos implementacao, testar com curl:

```bash
curl -X POST \
  'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/softruck-webhook' \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: SEU_SECRET' \
  -d '{
    "event": "DEVICES.ASSOCIATED",
    "timestamp": "2026-01-29T12:00:00Z",
    "data": {
      "device": { "id": "abc123", "imei": "123456789012345" },
      "vehicle": { "id": "xyz789", "plate": "ABC1234" }
    }
  }'
```

---

## Checklist de Implementacao

- [ ] Criar tabela `softruck_eventos`
- [ ] Criar Edge Function `softruck-webhook`
- [ ] Implementar handler para DEVICES.ASSOCIATED
- [ ] Implementar handler para DEVICES.DISASSOCIATED
- [ ] Implementar handler para VEHICLES.CREATED
- [ ] Implementar handler para VEHICLES.DELETED
- [ ] Implementar handler para device-events
- [ ] Registrar todos eventos em log
- [ ] Gerar alertas para eventos criticos
- [ ] Notificar analistas quando necessario
- [ ] Testar com evento simulado
- [ ] Configurar webhook no painel Softruck

---

## Bloqueador

Antes de configurar o webhook no painel Softruck:
1. A `SOFTRUCK_PUBLIC_KEY` deve estar valida (problema identificado anteriormente)
2. A Edge Function deve estar deployada e acessivel
3. O secret de validacao (se usado) deve ser configurado em ambos os lados

