
# Plano: Corrigir Autenticação SGA Hinova - Usar token_usuario no Header

## Problema Identificado

Comparando o código que **funciona** (`hinova-integration`) com o código atual (`sga-hinova-sync`), encontrei a diferença crítica:

### Sistema que Funciona (hinova-integration)
```text
AUTENTICAÇÃO:
  Header: Authorization: Bearer {TOKEN_FIXO}
  Body: { usuario, senha }
  → Retorna: token_usuario

OPERAÇÕES (cadastro, etc.):
  Header: Authorization: Bearer {token_usuario}  ← DINÂMICO
  Body: { ...dados }
```

### Sistema Atual (sga-hinova-sync) - COM PROBLEMA
```text
AUTENTICAÇÃO:
  Header: Authorization: Bearer {TOKEN_FIXO}
  Body: { usuario, senha }
  → Retorna: token_usuario  ✅

OPERAÇÕES (cadastro, etc.):
  Header: Authorization: Bearer {TOKEN_FIXO}  ← ERRADO! Usa token fixo
  Body: { usuario, senha, token_usuario, ...dados }
```

**O erro "Login ou senha inválido" ocorre porque:**
- O sistema está usando o Token Bearer fixo no header para operações de cadastro
- A API espera o `token_usuario` (dinâmico) no header Authorization para operações

---

## Correção Proposta

### Arquivo: `supabase/functions/sga-hinova-sync/index.ts`

#### Mudança 1: Criar headers dinâmicos após autenticação

Após obter o `token_usuario`, criar um novo conjunto de headers:

```typescript
// Linha ~398 - Após autenticação bem-sucedida
const tokenUsuario = authData.token_usuario;
console.log('[SGA Sync] Autenticação bem-sucedida');

// Headers para operações (usa token_usuario, não o token fixo)
const operationHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${tokenUsuario}`,  // ← TOKEN DINÂMICO
};
```

#### Mudança 2: Simplificar payload do cadastro

Remover credenciais redundantes do body:

```typescript
// Linhas ~410-434 - Payload do associado
const associadoPayload = {
  // REMOVER: usuario, senha, token_usuario - não são mais necessários no body
  nome: associado.nome,
  cpf: cleanCPF(associado.cpf),
  rg: associado.rg || '',
  data_nascimento: formatDateBR(associado.data_nascimento),
  // ... resto dos campos
  codigo_conta: parseInt(hinovaCodigoConta),
};
```

#### Mudança 3: Usar headers corretos nas chamadas

Substituir `authHeaders` por `operationHeaders` em todas as operações:

```typescript
// Linha ~456-462 - Cadastro de associado
const associadoResponse = await fetchWithRetry(
  `${hinovaApiUrl}/associado/cadastrar`,
  {
    method: 'POST',
    headers: operationHeaders,  // ← USAR TOKEN DINÂMICO
    body: JSON.stringify(associadoPayload)
  }
);
```

#### Mudança 4: Aplicar mesma correção ao cadastro de veículo e fotos

Todas as chamadas após autenticação devem usar `operationHeaders`:

```typescript
// Cadastro de veículo (~linha 530+)
headers: operationHeaders,

// Upload de fotos (~linha 600+)
headers: operationHeaders,
```

---

## Fluxo Corrigido

```text
+---------------------------------------------------------+
|  PASSO 1: AUTENTICAÇÃO                                  |
|  POST /usuario/autenticar                               |
|  Header: Authorization: Bearer {TOKEN_FIXO}             |
|  Body: { usuario, senha }                               |
|  → Retorna: token_usuario                               |
+---------------------------------------------------------+
                          |
                          v
+---------------------------------------------------------+
|  PASSO 2: OPERAÇÕES (cadastro, fotos, etc.)             |
|  POST /associado/cadastrar                              |
|  Header: Authorization: Bearer {token_usuario}  <-- FIX |
|  Body: { nome, cpf, ...dados }  <-- Sem credenciais     |
+---------------------------------------------------------+
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `supabase/functions/sga-hinova-sync/index.ts` | 1. Criar `operationHeaders` com `token_usuario` |
|  | 2. Remover `usuario`, `senha`, `token_usuario` do body de cadastro |
|  | 3. Usar `operationHeaders` em todas as chamadas pós-autenticação |

---

## Resumo da Correção

| Item | Antes (Errado) | Depois (Correto) |
|------|----------------|------------------|
| Header operações | `Bearer {TOKEN_FIXO}` | `Bearer {token_usuario}` |
| Body cadastro | Inclui `usuario/senha/token_usuario` | Apenas dados do associado |
| Baseado em | Suposição | Código funcional `hinova-integration` |
