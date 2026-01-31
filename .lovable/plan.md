

# Plano: Corrigir Integração SGA Hinova - Token no Body

## Resumo do Problema

A autenticação com a API Hinova funciona corretamente, mas todas as requisições subsequentes (cadastro de associado, veículo, fotos) falham com **"Acesso não autorizado"**.

**Causa raiz**: O código atual envia o `token_usuario` via headers HTTP, mas a API Hinova espera o token no **body (corpo) da requisição**.

```text
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL (INCORRETO)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. POST /usuario/autenticar                                │
│     Body: { usuario, senha }                                │
│     → Retorna: { token_usuario: "abc123..." } ✅            │
│                                                             │
│  2. POST /associado/cadastrar                               │
│     Headers: X-Token-Usuario: abc123... ❌                  │
│     Body: { nome, cpf, ... }                                │
│     → Erro: "Acesso não autorizado"                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    FLUXO CORRETO                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. POST /usuario/autenticar                                │
│     Body: { usuario, senha }                                │
│     → Retorna: { token_usuario: "abc123..." } ✅            │
│                                                             │
│  2. POST /associado/cadastrar                               │
│     Headers: Authorization: Bearer {TOKEN_BEARER}           │
│     Body: { token_usuario: "abc123...", nome, cpf, ... } ✅ │
│     → Sucesso: { codigo_associado: 12345 }                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Alterações Necessárias

### Arquivo: `supabase/functions/sga-hinova-sync/index.ts`

#### 1. Remover função `buildHinovaAuthHeaders`

**Antes (linhas 182-190):**
```typescript
const buildHinovaAuthHeaders = (tokenUsuario: string) => ({
  'Authorization': `Bearer ${hinovaToken}`,
  'X-Token-Usuario': tokenUsuario,
  token: tokenUsuario,
  'token_usuario': tokenUsuario,
  'Token-Usuario': tokenUsuario,
  TokenUsuario: tokenUsuario,
});
```

**Depois:**
```typescript
// Headers base para todas as requisições (SEM token_usuario)
const baseHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${hinovaToken}`,
};
```

---

#### 2. Corrigir cadastro de associado (linhas 377-410)

**Antes:**
```typescript
const associadoPayload = {
  nome: associado.nome,
  cpf: cleanCPF(associado.cpf),
  // ...demais campos
};

const associadoResponse = await fetchWithRetry(
  `${hinovaApiUrl}/associado/cadastrar`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildHinovaAuthHeaders(tokenUsuario)  // ❌ Token no header
    },
    body: JSON.stringify(associadoPayload)
  }
);
```

**Depois:**
```typescript
const associadoPayload = {
  token_usuario: tokenUsuario,  // ✅ Token no body
  nome: associado.nome,
  cpf: cleanCPF(associado.cpf),
  // ...demais campos
};

const associadoResponse = await fetchWithRetry(
  `${hinovaApiUrl}/associado/cadastrar`,
  {
    method: 'POST',
    headers: baseHeaders,  // ✅ Apenas Authorization Bearer
    body: JSON.stringify(associadoPayload)
  }
);
```

---

#### 3. Corrigir cadastro de veículo (linhas 469-498)

**Antes:**
```typescript
const veiculoPayload = {
  codigo_associado: codigoAssociadoHinova,
  placa: veiculo.placa || '',
  // ...demais campos
};

const veiculoResponse = await fetchWithRetry(
  `${hinovaApiUrl}/veiculo/cadastrar`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildHinovaAuthHeaders(tokenUsuario)  // ❌ Token no header
    },
    body: JSON.stringify(veiculoPayload)
  }
);
```

**Depois:**
```typescript
const veiculoPayload = {
  token_usuario: tokenUsuario,  // ✅ Token no body
  codigo_associado: codigoAssociadoHinova,
  placa: veiculo.placa || '',
  // ...demais campos
};

const veiculoResponse = await fetchWithRetry(
  `${hinovaApiUrl}/veiculo/cadastrar`,
  {
    method: 'POST',
    headers: baseHeaders,  // ✅ Apenas Authorization Bearer
    body: JSON.stringify(veiculoPayload)
  }
);
```

---

#### 4. Corrigir envio de fotos (linhas 566-578)

**Antes:**
```typescript
const fotosResponse = await fetchWithRetry(
  `${hinovaApiUrl}/veiculo/foto/cadastrar`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildHinovaAuthHeaders(tokenUsuario)  // ❌ Token no header
    },
    body: JSON.stringify({
      codigo_veiculo: codigoVeiculoHinova,
      foto: fotos
    })
  }
);
```

**Depois:**
```typescript
const fotosResponse = await fetchWithRetry(
  `${hinovaApiUrl}/veiculo/foto/cadastrar`,
  {
    method: 'POST',
    headers: baseHeaders,  // ✅ Apenas Authorization Bearer
    body: JSON.stringify({
      token_usuario: tokenUsuario,  // ✅ Token no body
      codigo_veiculo: codigoVeiculoHinova,
      foto: fotos
    })
  }
);
```

---

## Resumo das Mudanças

| Local | Antes | Depois |
|-------|-------|--------|
| Headers | 6 variações de token (`X-Token-Usuario`, `token`, etc.) | Apenas `Authorization: Bearer {TOKEN_BEARER}` |
| Body associado | Sem `token_usuario` | Com `token_usuario` como primeiro campo |
| Body veículo | Sem `token_usuario` | Com `token_usuario` como primeiro campo |
| Body fotos | Sem `token_usuario` | Com `token_usuario` como primeiro campo |

---

## Etapas de Implementação

1. **Substituir** a função `buildHinovaAuthHeaders` por uma constante `baseHeaders` simples
2. **Adicionar** `token_usuario` ao payload de cadastro de associado
3. **Adicionar** `token_usuario` ao payload de cadastro de veículo
4. **Adicionar** `token_usuario` ao payload de envio de fotos
5. **Atualizar** todas as chamadas `fetch` para usar `baseHeaders`
6. **Deploy** automático da Edge Function
7. **Testar** o fluxo completo

---

## Validação Pós-Implementação

Após a correção, o fluxo esperado:

1. **Testar Conexão** → Deve retornar sucesso (já funciona)
2. **Enviar para SGA** → Deve cadastrar associado + veículo sem erro de autorização
3. **Verificar logs** → Tabela `sga_sync_logs` deve mostrar `status: success` para todas as etapas

