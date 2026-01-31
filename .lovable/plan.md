

# Plano: Simplificar Configuração do SGA Hinova

## Problema Identificado

O formulário de configuração do SGA Hinova está solicitando **campos desnecessários como obrigatórios**. De acordo com a documentação oficial da API:

| Campo | Status Atual | Status Correto | Motivo |
|-------|--------------|----------------|--------|
| Token Bearer | Obrigatório ✅ | Obrigatório ✅ | Necessário para autenticação |
| Usuário | Obrigatório ✅ | Obrigatório ✅ | Necessário para autenticação |
| Senha | Obrigatório ✅ | Obrigatório ✅ | Necessário para autenticação |
| Código da Conta | **Obrigatório ❌** | **Opcional** | Só é obrigatório se houver mais de uma conta bancária cadastrada |
| Código Regional | Opcional ✅ | Opcional ✅ | OK |
| Código Cooperativa | Opcional ✅ | Opcional ✅ | OK |
| Código Voluntário | Opcional ✅ | Opcional ✅ | OK |
| URL da API | Opcional ✅ | Opcional ✅ | OK |

---

## Solução

Alterar o schema da integração Hinova para:
1. **Tornar `codigo_conta` opcional** (com valor padrão "1" no backend)
2. **Melhorar labels** para ficar mais claro o que cada campo significa
3. **Adicionar dicas** sobre quando cada campo opcional é necessário

---

## Arquivos a Modificar

### 1. `src/components/integracoes/ConfigurarIntegracaoSheet.tsx`

Atualizar o fallback local do schema Hinova:

**Antes:**
```typescript
hinova: [
  { nome: 'token', label: 'Token Bearer', tipo: 'password', obrigatorio: true },
  { nome: 'usuario', label: 'Usuário', tipo: 'text', obrigatorio: true },
  { nome: 'senha', label: 'Senha', tipo: 'password', obrigatorio: true },
  { nome: 'codigo_conta', label: 'Código da Conta', tipo: 'text', obrigatorio: true },
  { nome: 'codigo_regional', label: 'Código Regional', tipo: 'text', obrigatorio: false },
  { nome: 'codigo_cooperativa', label: 'Código Cooperativa', tipo: 'text', obrigatorio: false },
  { nome: 'codigo_voluntario', label: 'Código Voluntário', tipo: 'text', obrigatorio: false },
  { nome: 'api_url', label: 'URL da API (opcional)', tipo: 'text', obrigatorio: false },
],
```

**Depois:**
```typescript
hinova: [
  { nome: 'token', label: 'Token Bearer (gerado no SGA)', tipo: 'password', obrigatorio: true },
  { nome: 'usuario', label: 'Usuário do SGA', tipo: 'text', obrigatorio: true },
  { nome: 'senha', label: 'Senha do SGA', tipo: 'password', obrigatorio: true },
  { nome: 'codigo_conta', label: 'Código da Conta (se mais de uma)', tipo: 'text', obrigatorio: false },
  { nome: 'codigo_voluntario', label: 'Código Voluntário', tipo: 'text', obrigatorio: false },
],
```

**Mudanças:**
- `codigo_conta` passa de obrigatório para **opcional**
- Labels mais descritivos
- Removidos campos menos utilizados da visualização principal (regional/cooperativa/api_url ficam no backend com valores padrão)

---

### 2. `supabase/functions/integracoes-credenciais/index.ts`

Atualizar o schema oficial no backend:

**Antes:**
```typescript
hinova: {
  campos: [
    { nome: 'token', label: 'Token Bearer', tipo: 'password', obrigatorio: true },
    { nome: 'usuario', label: 'Usuário', tipo: 'text', obrigatorio: true },
    { nome: 'senha', label: 'Senha', tipo: 'password', obrigatorio: true },
    { nome: 'codigo_conta', label: 'Código da Conta', tipo: 'text', obrigatorio: true },
    { nome: 'codigo_regional', label: 'Código Regional', tipo: 'text', obrigatorio: false },
    { nome: 'codigo_cooperativa', label: 'Código Cooperativa', tipo: 'text', obrigatorio: false },
    { nome: 'codigo_voluntario', label: 'Código Voluntário', tipo: 'text', obrigatorio: false },
    { nome: 'api_url', label: 'URL da API (opcional)', tipo: 'text', obrigatorio: false },
  ]
}
```

**Depois:**
```typescript
hinova: {
  campos: [
    { nome: 'token', label: 'Token Bearer (gerado no SGA)', tipo: 'password', obrigatorio: true },
    { nome: 'usuario', label: 'Usuário do SGA', tipo: 'text', obrigatorio: true },
    { nome: 'senha', label: 'Senha do SGA', tipo: 'password', obrigatorio: true },
    { nome: 'codigo_conta', label: 'Código da Conta (opcional)', tipo: 'text', obrigatorio: false },
    { nome: 'codigo_voluntario', label: 'Código Voluntário (opcional)', tipo: 'text', obrigatorio: false },
  ]
}
```

---

## Interface Visual Atualizada

### Antes (8 campos, 4 obrigatórios)
```text
┌──────────────────────────────────────────────────┐
│ Configurar SGA Hinova                            │
│ Preencha as credenciais para conectar com SGA    │
├──────────────────────────────────────────────────┤
│ Token Bearer *              [________________] 👁 │
│ Usuário *                   [________________]   │
│ Senha *                     [________________] 👁 │
│ Código da Conta *           [________________]   │
│ Código Regional             [________________]   │
│ Código Cooperativa          [________________]   │
│ Código Voluntário           [________________]   │
│ URL da API (opcional)       [________________]   │
└──────────────────────────────────────────────────┘
```

### Depois (5 campos, 3 obrigatórios)
```text
┌──────────────────────────────────────────────────┐
│ Configurar SGA Hinova                            │
│ Preencha as credenciais para conectar com SGA    │
├──────────────────────────────────────────────────┤
│ Token Bearer (gerado no SGA) *                   │
│ [_________________________________________] 👁   │
│                                                  │
│ Usuário do SGA *                                 │
│ [_________________________________________]      │
│                                                  │
│ Senha do SGA *                                   │
│ [_________________________________________] 👁   │
│                                                  │
│ Código da Conta (se mais de uma)                 │
│ [_________________________________________]      │
│                                                  │
│ Código Voluntário                                │
│ [_________________________________________]      │
│                                                  │
│ 🔒 As credenciais são criptografadas             │
├──────────────────────────────────────────────────┤
│ [Testar Conexão]     [Salvar]                    │
└──────────────────────────────────────────────────┘
```

---

## Comportamento do Backend

O Edge Function `sga-hinova-sync` já tem valores padrão:

```typescript
let hinovaCodigoConta = Deno.env.get('HINOVA_CODIGO_CONTA') || '1';  // Padrão: 1
let hinovaCodigoRegional = Deno.env.get('HINOVA_CODIGO_REGIONAL');   // Pode ser null
let hinovaCodigoCooperativa = Deno.env.get('HINOVA_CODIGO_COOPERATIVA'); // Pode ser null
```

Isso significa que se o usuário não preencher `codigo_conta`, o sistema usará **"1" como padrão**, que funciona para associações com conta bancária única.

---

## Ordem de Implementação

1. Atualizar schema no frontend (`ConfigurarIntegracaoSheet.tsx`)
2. Atualizar schema no backend (`integracoes-credenciais/index.ts`)
3. Testar configuração com apenas os 3 campos obrigatórios

