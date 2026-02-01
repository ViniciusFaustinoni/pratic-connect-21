
# Plano: Diagnóstico e Correção do Erro de Token Bearer SGA Hinova

## Diagnóstico do Problema

Após análise detalhada dos logs e código:

| Etapa | Status | Detalhe |
|-------|--------|---------|
| Buscar credenciais do banco | ✅ Sucesso | `token`, `usuario`, `senha` são carregados corretamente |
| Autenticação (`/usuario/autenticar`) | ✅ Sucesso | Retorna `token_usuario` válido → credenciais usuário/senha funcionam |
| Cadastro (`/associado/cadastrar`) | ❌ Falha | "Login ou senha inválido" mesmo com `token_usuario` válido |

### Causa Raiz Identificada

A API Hinova v2 possui **duas camadas de autenticação**:

1. **Token Bearer (Header)**: Token da API gerado no painel SGA pela Associação - autoriza a aplicação a fazer requisições
2. **Usuario/Senha/Token_Usuario (Body)**: Identifica a sessão do operador

O erro "Login ou senha inválido" no cadastro indica que o **Token Bearer no header `Authorization`** está sendo rejeitado pela API Hinova, mesmo que as credenciais no body estejam corretas.

Possíveis causas:
- Token Bearer **expirado** ou **revogado** no painel Hinova
- Token Bearer **sem permissões** para operações de escrita (cadastro)
- Token Bearer copiado com **caracteres inválidos** (espaços, quebras de linha)

---

## Solução

### Parte 1: Ação Manual (Usuário)

1. Acessar o **Painel Administrativo do SGA Hinova**
2. Navegar até **Configurações > API / Tokens** (ou seção similar)
3. **Gerar um novo Token Bearer** com permissões completas (leitura e escrita)
4. Copiar o token **exatamente** (sem espaços extras no início ou fim)
5. No sistema, acessar **Configurações > Integrações > Serviços > SGA Hinova > Editar**
6. Colar o novo token no campo **Token Bearer (gerado no SGA)**
7. Clicar em **Salvar**
8. Clicar em **Testar Conexão** para validar
9. Tentar novamente **Enviar para SGA** na tela de Ativações

### Parte 2: Melhorias no Sistema (Implementação)

Para evitar confusão futura, implementarei melhorias no diagnóstico de erros:

#### Arquivo 1: `supabase/functions/sga-hinova-sync/index.ts`

Adicionar detecção específica de erro de token inválido e retornar resposta mais clara:

```typescript
// Após receber resposta de erro no cadastro
if (!associadoResponse.ok) {
  const isTokenError = 
    associadoData.mensagem?.includes('token de acesso') ||
    associadoData.error?.some((e: string) => 
      e.toLowerCase().includes('login') || 
      e.toLowerCase().includes('senha')
    );
  
  if (isTokenError && authData.token_usuario) {
    // Usuário/senha funcionaram na autenticação, então o problema é o Token Bearer
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Token Bearer da API Hinova inválido ou expirado. ' +
             'Gere um novo token no painel SGA e atualize em Configurações > Integrações.',
      step: 'associado',
      action_required: 'update_bearer_token',
      details: associadoData
    }), { status: 401, headers: {...} });
  }
}
```

Adicionar logging melhorado para debug:

```typescript
console.log('[SGA Sync] Token Bearer carregado:', hinovaToken ? `${hinovaToken.slice(0,10)}...` : 'VAZIO');
```

#### Arquivo 2: `src/components/ativacao/BotaoEnviarSGA.tsx`

Tratar o erro de token de forma amigável no frontend:

```typescript
if (data?.action_required === 'update_bearer_token') {
  toast.error('Token SGA Hinova Expirado', {
    description: 'O token da API precisa ser atualizado. Acesse Configurações > Integrações.',
    duration: 10000,
  });
  return;
}
```

#### Arquivo 3: Adicionar validação no teste de conexão

O teste de conexão atual só valida autenticação (usuário/senha). Vou adicionar uma chamada de teste que valide também o Token Bearer para operações de escrita:

```typescript
// No test_connection, após autenticar com sucesso:
// Fazer uma requisição de leitura simples para validar Token Bearer
const testReadResponse = await fetch(`${hinovaApiUrl}/associado/consultar`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hinovaToken}` },
  body: JSON.stringify({ 
    usuario: hinovaUsuario, 
    senha: hinovaSenha, 
    token_usuario: authData.token_usuario,
    cpf: '00000000000' // CPF inválido só para testar permissão
  })
});
// Se retornar 401/403, Token Bearer está inválido
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/sga-hinova-sync/index.ts` | Detecção de erro de Token Bearer + logging melhorado + validação no teste de conexão |
| `src/components/ativacao/BotaoEnviarSGA.tsx` | Tratamento amigável de erro de token expirado |

---

## Resumo

O problema é que o **Token Bearer** (diferente de usuário/senha) está expirado ou inválido na API Hinova. A solução imediata é gerar um novo token no painel Hinova e atualizar nas configurações. A implementação adicionará melhor diagnóstico para que esse tipo de erro seja mais claro no futuro.
