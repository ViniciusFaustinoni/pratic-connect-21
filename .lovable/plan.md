
# Plano: Corrigir Headers da API Hinova

## Diagnóstico Confirmado

Com base nos logs do banco de dados, identifiquei o padrão exato dos erros:

| Configuração testada | Erro retornado pela API |
|---------------------|-------------------------|
| Sem `Authorization` header | "Parâmetro Authorization incorreto" |
| Com `Authorization` + usuario/senha no body | "Login ou senha inválido" |

**Conclusão**: A API Hinova exige:
1. **Header obrigatório**: `Authorization: Bearer {TOKEN_API}` - sempre!
2. **Body**: Apenas `token_usuario` + dados (NÃO enviar usuario/senha novamente)

O código atual está incorretamente:
- Removendo o header `Authorization` nas requisições de cadastro (`baseHeaders`)
- Enviando `usuario` e `senha` no body (causando revalidação desnecessária)

---

## Alterações Necessárias

### Arquivo: `supabase/functions/sga-hinova-sync/index.ts`

#### 1. Remover `baseHeaders` e usar `authHeaders` em todas as requisições

**Antes (linhas 185-188):**
```typescript
// Headers para requisições de cadastro (SEM Authorization - credenciais vão no body)
const baseHeaders = {
  'Content-Type': 'application/json',
};
```

**Depois:**
```typescript
// Remover baseHeaders - usar authHeaders em TODAS as requisições
```

---

#### 2. Corrigir cadastro de associado - REMOVER usuario/senha do body

**Antes (linhas 376-400):**
```typescript
const associadoPayload = {
  usuario: hinovaUsuario,      // ❌ REMOVER
  senha: hinovaSenha,          // ❌ REMOVER
  token_usuario: tokenUsuario,
  nome: associado.nome,
  // ...
};

const associadoResponse = await fetchWithRetry(
  `${hinovaApiUrl}/associado/cadastrar`,
  {
    method: 'POST',
    headers: baseHeaders,  // ❌ SEM Authorization
    body: JSON.stringify(associadoPayload)
  }
);
```

**Depois:**
```typescript
const associadoPayload = {
  token_usuario: tokenUsuario,  // ✅ Apenas token_usuario
  nome: associado.nome,
  // ...
};

const associadoResponse = await fetchWithRetry(
  `${hinovaApiUrl}/associado/cadastrar`,
  {
    method: 'POST',
    headers: authHeaders,  // ✅ COM Authorization: Bearer
    body: JSON.stringify(associadoPayload)
  }
);
```

---

#### 3. Corrigir cadastro de veículo - REMOVER usuario/senha do body

**Antes:**
```typescript
const veiculoPayload = {
  usuario: hinovaUsuario,      // ❌ REMOVER
  senha: hinovaSenha,          // ❌ REMOVER
  token_usuario: tokenUsuario,
  codigo_associado: codigoAssociadoHinova,
  // ...
};

headers: baseHeaders,  // ❌ SEM Authorization
```

**Depois:**
```typescript
const veiculoPayload = {
  token_usuario: tokenUsuario,  // ✅ Apenas token_usuario
  codigo_associado: codigoAssociadoHinova,
  // ...
};

headers: authHeaders,  // ✅ COM Authorization: Bearer
```

---

#### 4. Corrigir envio de fotos - REMOVER usuario/senha do body

**Antes:**
```typescript
body: JSON.stringify({
  usuario: hinovaUsuario,      // ❌ REMOVER
  senha: hinovaSenha,          // ❌ REMOVER
  token_usuario: tokenUsuario,
  codigo_veiculo: codigoVeiculoHinova,
  foto: fotos
})

headers: baseHeaders,  // ❌ SEM Authorization
```

**Depois:**
```typescript
body: JSON.stringify({
  token_usuario: tokenUsuario,  // ✅ Apenas token_usuario
  codigo_veiculo: codigoVeiculoHinova,
  foto: fotos
})

headers: authHeaders,  // ✅ COM Authorization: Bearer
```

---

## Resumo das Mudanças

| Item | Antes | Depois |
|------|-------|--------|
| Header de cadastro | `baseHeaders` (sem Authorization) | `authHeaders` (com Authorization: Bearer) |
| Body associado | usuario + senha + token_usuario | apenas token_usuario |
| Body veículo | usuario + senha + token_usuario | apenas token_usuario |
| Body fotos | usuario + senha + token_usuario | apenas token_usuario |

---

## Fluxo Correto Após Correção

```text
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO CORRETO                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. POST /usuario/autenticar                                │
│     Headers: Authorization: Bearer {TOKEN_API}              │
│     Body: { usuario, senha }                                │
│     → Retorna: { token_usuario: "abc123..." } ✅            │
│                                                             │
│  2. POST /associado/cadastrar                               │
│     Headers: Authorization: Bearer {TOKEN_API}              │
│     Body: { token_usuario: "abc123...", nome, cpf, ... } ✅ │
│     → Sucesso: { codigo_associado: 12345 }                  │
│                                                             │
│  3. POST /veiculo/cadastrar                                 │
│     Headers: Authorization: Bearer {TOKEN_API}              │
│     Body: { token_usuario, codigo_associado, placa, ... } ✅│
│     → Sucesso: { codigo_veiculo: 67890 }                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Etapas de Implementação

1. Remover a constante `baseHeaders` do código
2. Substituir todas as ocorrências de `baseHeaders` por `authHeaders`
3. Remover `usuario` e `senha` do payload de cadastro de associado
4. Remover `usuario` e `senha` do payload de cadastro de veículo
5. Remover `usuario` e `senha` do payload de envio de fotos
6. Deploy automático da Edge Function
7. Testar o fluxo "Enviar para SGA"

---

## Validação Pós-Implementação

Após a correção, verificar nos logs `sga_sync_logs`:
- `action: autenticar` → `status: success`
- `action: cadastrar_associado` → `status: success` (antes estava `error`)
- `action: cadastrar_veiculo` → `status: success`
