# Plano: Corrigir Autenticação SGA Hinova - IMPLEMENTADO ✅

## Status: CONCLUÍDO

## Problema Identificado e Corrigido

A diferença crítica entre o código que funciona (`hinova-integration`) e o código anterior:

### Antes (Errado)
```text
OPERAÇÕES (cadastro, etc.):
  Header: Authorization: Bearer {TOKEN_FIXO}  ← ERRADO!
  Body: { usuario, senha, token_usuario, ...dados }
```

### Depois (Correto) ✅
```text
OPERAÇÕES (cadastro, etc.):
  Header: Authorization: Bearer {token_usuario}  ← TOKEN DINÂMICO
  Body: { ...dados }  ← SEM credenciais
```

---

## Alterações Realizadas

### Arquivo: `supabase/functions/sga-hinova-sync/index.ts`

1. ✅ **Criado `operationHeaders`** - Usa `token_usuario` dinâmico no header Authorization
2. ✅ **Payload do associado simplificado** - Removido `usuario`, `senha`, `token_usuario` do body
3. ✅ **Payload do veículo simplificado** - Removido `usuario`, `senha`, `token_usuario` do body
4. ✅ **Payload de fotos simplificado** - Removido `usuario`, `senha`, `token_usuario` do body
5. ✅ **Todas as chamadas pós-autenticação** usam `operationHeaders` ao invés de `authHeaders`

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
|  Header: Authorization: Bearer {token_usuario}  ✅      |
|  Body: { nome, cpf, ...dados }  (sem credenciais)       |
+---------------------------------------------------------+
```

---

## Próximo Passo

Testar clicando em "Enviar para SGA" na tela de ativações para verificar se o cadastro funciona.
