
# Plano de Alinhamento: IA do WhatsApp com IA do App

## Diagnóstico

Após análise detalhada dos códigos, identifiquei que **a IA do WhatsApp NÃO está 100% alinhada com a IA do App**. Embora compartilhem a mesma estrutura de tools e salvem dados nas mesmas tabelas, existem diferenças críticas que podem causar comportamentos inconsistentes.

---

## Gaps Identificados

### Gap 1: Modelo de IA Diferente
- **App**: `google/gemini-3-flash-preview` via `ai.gateway.lovable.dev`
- **WhatsApp**: `gpt-4o-mini` via `api.lovable.dev` (endpoint legado)

### Gap 2: Verificação de Cobertura Ausente
O App verifica coberturas antes de criar solicitações:
```
Se veículo tem apenas "Roubo/Furto":
- ✅ PERMITIDO: Sinistros de roubo/furto
- ❌ BLOQUEADO: Assistência 24h, colisão, etc.
```
O WhatsApp NÃO faz essa verificação.

### Gap 3: Contexto Incompleto
- **App**: Envia dados de cobertura dos veículos (`cobertura_roubo_furto`, `cobertura_total`)
- **WhatsApp**: Envia apenas dados básicos (placa, marca, modelo)

### Gap 4: Tool `reverse_geocode` Ausente
- **App**: Tem a tool para converter coordenadas GPS em endereço
- **WhatsApp**: Pede endereço digitado como workaround

---

## Plano de Implementação

### Fase 1: Atualizar Modelo e Endpoint
**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

Alterar a função `callAI` para usar:
- Modelo: `google/gemini-3-flash-preview`
- Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions`

```text
Antes:
- model: "gpt-4o-mini"
- endpoint: api.lovable.dev

Depois:
- model: "google/gemini-3-flash-preview"
- endpoint: ai.gateway.lovable.dev
```

### Fase 2: Adicionar Verificação de Cobertura ao Contexto
**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

Atualizar função `getAssociadoContext` para incluir:
1. Dados de cobertura dos veículos (`cobertura_roubo_furto`, `cobertura_total`)
2. Instrução clara sobre regras de cobertura no System Prompt

```text
Query atual:
SELECT placa, marca, modelo, ano

Query nova:
SELECT placa, marca, modelo, ano, status, cobertura_roubo_furto, cobertura_total
```

### Fase 3: Adicionar Regras de Cobertura ao System Prompt
**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

Adicionar ao `WHATSAPP_SYSTEM_PROMPT`:

```text
## REGRAS DE COBERTURA (VERIFICAR SEMPRE!)
Antes de criar solicitação, verifique a cobertura:

Se veículo tem apenas "Roubo/Furto":
- ✅ PERMITIDO: Sinistros de roubo/furto
- ❌ BLOQUEADO: Assistência 24h, colisão, incêndio

Se veículo tem "Total":
- ✅ TUDO LIBERADO

Resposta quando bloqueado:
"Sua cobertura atual é apenas para roubo/furto. 
Após a instalação do rastreador, você terá acesso à cobertura total."
```

### Fase 4: Adicionar Tool `reverse_geocode`
**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

Adicionar ao array `tools`:

```javascript
{
  type: "function",
  function: {
    name: "reverse_geocode",
    description: "Converte coordenadas GPS em endereço",
    parameters: {
      type: "object",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" }
      },
      required: ["latitude", "longitude"]
    }
  }
}
```

Adicionar implementação na função `executeTool`:

```javascript
case "reverse_geocode": {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/reverse-geocode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: args.latitude,
      longitude: args.longitude
    })
  });
  // ... processar resposta
}
```

---

## Resumo de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/whatsapp-webhook/index.ts` | Atualizar modelo para Gemini 3 Flash |
| `supabase/functions/whatsapp-webhook/index.ts` | Atualizar endpoint para ai.gateway.lovable.dev |
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar dados de cobertura ao contexto |
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar regras de cobertura ao System Prompt |
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar tool `reverse_geocode` |

---

## Resultado Esperado

Após implementação:

1. **Consistência**: Associado terá mesma experiência no App e no WhatsApp
2. **Regras de Negócio**: Bloqueio de assistência 24h para veículos sem cobertura total
3. **Geocoding**: Suporte a localização GPS no WhatsApp
4. **Modelo Atualizado**: Respostas mais precisas com Gemini 3 Flash
