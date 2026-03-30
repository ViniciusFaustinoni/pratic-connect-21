

# Corrigir: Edge Functions ASAAS devem ler credenciais da tabela `integracoes_credenciais`

## Problema Raiz

O sistema tem **dois locais diferentes** para armazenar a API key do ASAAS:

1. **Supabase Secrets** (`Deno.env.get('ASAAS_API_KEY')`) — usado por todas as 14 edge functions
2. **Tabela `integracoes_credenciais`** — onde a UI salva quando você configura na área de Integrações

Quando você muda a chave na UI, ela vai para a tabela. Mas as edge functions continuam lendo do secret antigo.

## Solução

Criar uma **função utilitária compartilhada** que todas as edge functions ASAAS usam para obter a API key e a base URL. A lógica:

1. Tentar ler da tabela `integracoes_credenciais` (fonte primária — é onde a UI salva)
2. Se não encontrar, fallback para `Deno.env.get('ASAAS_API_KEY')` (retrocompatibilidade)
3. Determinar o ambiente (sandbox/production) com base no campo `ambiente` salvo na tabela OU pelo prefixo da chave

```text
UI salva credenciais → integracoes_credenciais (encrypted)
                          ↓
         getAsaasCredenciais() ← todas edge functions usam
                          ↓
              { apiKey, baseUrl, ambiente }
```

## Implementação

### 1. Criar helper `supabase/functions/_shared/asaas-config.ts`

Função `getAsaasCredenciais(supabase, serviceKey)` que:
- Busca da tabela `integracoes_credenciais` onde `integracao = 'asaas'`
- Descriptografa usando a mesma lógica do `integracoes-credenciais/index.ts`
- Retorna `{ apiKey, baseUrl, ambiente }`
- Fallback para env vars se a tabela não tiver dados

### 2. Atualizar as 14 edge functions que usam `ASAAS_API_KEY`

Substituir `Deno.env.get('ASAAS_API_KEY')` pelo helper em cada uma:

| Edge Function | Alteração |
|---|---|
| `asaas-clientes/index.ts` | Usar helper |
| `asaas-cobrancas/index.ts` | Usar helper |
| `asaas-cobranca-adesao/index.ts` | Usar helper |
| `asaas-verificar-pagamento/index.ts` | Usar helper |
| `asaas-verificar-cota-sinistro/index.ts` | Usar helper |
| `buscar-boletos-associado/index.ts` | Usar helper |
| `detalhe-boleto/index.ts` | Usar helper |
| `emitir-boleto-individual/index.ts` | Usar helper |
| `gerar-cobrancas-mensais/index.ts` | Usar helper |
| `gerar-faturas-mensais/index.ts` | Usar helper |
| `processar-reprovacao/index.ts` | Usar helper |
| `api-externa/index.ts` | Usar helper |
| `autentique-webhook/index.ts` | Usar helper |
| `cron-integracoes-health-check/index.ts` | Usar helper |

### 3. Atualizar `integracoes-verificar-secrets/index.ts`

Verificar status do ASAAS também pela tabela `integracoes_credenciais`, não apenas pelo env var.

## Padrão de cada função atualizada

Antes:
```typescript
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!;
const isSandbox = ASAAS_API_KEY?.includes('_hmlg_');
const ASAAS_BASE_URL = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
```

Depois:
```typescript
// Dentro do handler (precisa do supabase client)
const asaasConfig = await getAsaasCredenciais(supabase, SUPABASE_SERVICE_ROLE_KEY);
if (!asaasConfig) throw new Error('ASAAS não configurado');
const { apiKey, baseUrl } = asaasConfig;
```

A chave muda de ser lida no escopo global para dentro do handler, pois precisa do Supabase client para acessar a tabela.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/_shared/asaas-config.ts` | **Novo** — helper com crypto + busca na tabela |
| 14 edge functions ASAAS | Substituir leitura do env var pelo helper |
| `supabase/functions/integracoes-verificar-secrets/index.ts` | Checar tabela para status ASAAS |

