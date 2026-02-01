
# Plano: Corrigir Fluxo de Autenticação SGA Hinova

## Diagnóstico do Problema

O código atual faz:
1. **Autenticação**: `Authorization: Bearer {token_fixo}` (header) + `usuario/senha` (body) → Recebe `token_usuario`
2. **Cadastro**: `Authorization: Bearer {token_fixo}` (header) + `usuario/senha/token_usuario` (body) ❌

**O problema**: Após a autenticação, as requisições subsequentes devem usar o `token_usuario` gerado como autenticação, não o Token Bearer fixo das configurações.

## Correção Proposta

### Fluxo Correto (baseado na sua explicação)

```text
┌─────────────────────────────────────────────────────────────────┐
│ PASSO 1: AUTENTICAÇÃO                                           │
│ POST /usuario/autenticar                                        │
│ Header: Authorization: Bearer {token_configuracao}              │
│ Body: { usuario, senha }                                        │
│ Retorno: { token_usuario: "abc123..." }                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASSO 2: OPERAÇÕES (cadastro, etc.)                             │
│ POST /associado/cadastrar                                       │
│ Header: Authorization: Bearer {token_configuracao}              │
│ Body: { usuario, senha, token_usuario, ...dados }               │
│                                                                 │
│ O token_usuario no body é obrigatório para autorizar a ação    │
└─────────────────────────────────────────────────────────────────┘
```

Revisando o código novamente, **ele já está fazendo isso corretamente**:
- Linha 413: `token_usuario: tokenUsuario` está sendo incluído no body do cadastro

O erro "Login ou senha inválido" está vindo da API mesmo com o `token_usuario` válido no body.

## Investigação Adicional Necessária

O problema pode ser:
1. **O Token Bearer (header) realmente está expirado** na API Hinova
2. **O token_usuario tem escopo limitado** e não autoriza cadastro
3. **Formato do payload está diferente** do que o n8n envia

### Comparação Necessária

Preciso ver como o n8n faz a **segunda chamada** (cadastro), não apenas a autenticação. 

Você poderia compartilhar o node do n8n que faz o **cadastro do associado** (não a autenticação)?

## Melhoria Imediata no Código

Mesmo assim, vou melhorar o logging para capturar exatamente o que está sendo enviado:

### Arquivo: `supabase/functions/sga-hinova-sync/index.ts`

Adicionar logging completo do request de cadastro para comparar com n8n:

```typescript
// Antes de enviar o cadastro
console.log('[SGA Sync] ===== DEBUG CADASTRO =====');
console.log('[SGA Sync] URL:', `${hinovaApiUrl}/associado/cadastrar`);
console.log('[SGA Sync] Method: POST');
console.log('[SGA Sync] Headers:', {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${hinovaToken.slice(0, 20)}...`
});
console.log('[SGA Sync] Body keys:', Object.keys(associadoPayload));
console.log('[SGA Sync] token_usuario presente:', !!associadoPayload.token_usuario);
console.log('[SGA Sync] token_usuario length:', associadoPayload.token_usuario?.length);
console.log('[SGA Sync] ===========================');
```

E adicionar o response completo para debug:

```typescript
// Após receber resposta
console.log('[SGA Sync] ===== DEBUG RESPONSE =====');
console.log('[SGA Sync] Status:', associadoResponse.status);
console.log('[SGA Sync] Status Text:', associadoResponse.statusText);
console.log('[SGA Sync] Response Body:', JSON.stringify(associadoData));
console.log('[SGA Sync] ============================');
```

---

## Resumo

| Item | Status |
|------|--------|
| `token_usuario` no body do cadastro | ✅ Já está implementado |
| Token Bearer no header | ✅ Já está implementado |
| Logging detalhado para debug | 🔧 Será melhorado |

### Ação Necessária

Para diagnosticar definitivamente, preciso que você **compartilhe o node do n8n que faz o cadastro** (POST /associado/cadastrar), para comparar:
1. Se o n8n usa o mesmo Token Bearer no header
2. Se o n8n inclui `token_usuario` no body
3. Se há diferença no formato dos dados

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/sga-hinova-sync/index.ts` | Adicionar logging detalhado para debug de comparação com n8n |
