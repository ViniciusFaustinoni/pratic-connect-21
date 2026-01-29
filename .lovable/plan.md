

# Revisao Completa - Sistema de Autenticacao Softruck

## Resumo Executivo

Apos analise detalhada do sistema de autenticacao com a API Softruck, identifiquei a seguinte situacao:

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint de autenticacao | PARCIALMENTE CORRETO | Usa `/auth/login` mas baseUrl ja inclui `/v2` |
| Header `public-key` | IMPLEMENTADO | Presente em todas chamadas |
| Armazenamento `refresh_token` | IMPLEMENTADO | Salvo na tabela `rastreadores_tokens_cache` |
| Token Bearer nas chamadas | IMPLEMENTADO | Presente corretamente |
| Cache de token | IMPLEMENTADO | Verifica expiracao antes de usar |
| Tratamento erro 401 | NAO IMPLEMENTADO | Nao ha retry automatico |
| Alternancia sandbox/producao | IMPLEMENTADO | Busca da tabela `rastreadores_config_plataformas` |

---

## Problema Critico Detectado

Ao testar a autenticacao em ambiente real, recebi o erro:

```text
Falha auth Softruck: 401 - {"error":{"message":"Public key does not exist"}}
```

**Causa:** A `SOFTRUCK_PUBLIC_KEY` configurada nos secrets pode estar incorreta ou a conta Softruck pode nao estar ativa/configurada corretamente.

---

## Analise Detalhada dos Pontos Solicitados

### 1. Consulta de Posicao de Rastreador

**Arquivos analisados:** `rastreador-posicao/index.ts`, `posicao-veiculo/index.ts`

**Status:** CORRETO

```typescript
// posicao-veiculo/index.ts (linha 347-361)
const authResponse = await fetch(
  `${supabaseUrl}/functions/v1/rastreador-auth`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ plataforma: 'softruck' })
  }
);

// Chamada com Bearer token (linha 105-112)
const response = await fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'public-key': publicKey,
    'Content-Type': 'application/json',
  }
});
```

### 2. Envio de Comandos (bloquear/desbloquear)

**Status:** NAO IMPLEMENTADO

A plataforma Softruck esta configurada no banco com `suporta_bloqueio: false`. Nao existe edge function para comandos de bloqueio/desbloqueio.

### 3. Tratamento de Token Expirado

**Status:** PARCIALMENTE IMPLEMENTADO

**Cache de token funciona:**
```typescript
// rastreador-auth/index.ts (linha 97-118)
if (!force_refresh) {
  const { data: cached } = await supabase
    .from('rastreadores_tokens_cache')
    .select('token, refresh_token, expires_at')
    .eq('plataforma', plataforma)
    .gt('expires_at', new Date().toISOString())  // Verifica expiracao
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (cached) {
    return { success: true, token: cached.token, from_cache: true };
  }
}
```

**GAP:** Nao ha tratamento de erro 401 com retry automatico nas chamadas de API.

### 4. Tratamento de Erro 401

**Status:** NAO IMPLEMENTADO

Quando uma chamada retorna 401, o sistema apenas lanca erro sem tentar renovar o token:

```typescript
// posicao-veiculo/index.ts (linha 114-117)
if (!response.ok) {
  const error = await response.text();
  throw new Error(`Erro Softruck ${response.status}: ${error}`);
  // NAO HA TENTATIVA DE RENOVAR TOKEN E RETRY
}
```

---

## Configuracao Atual no Banco

```sql
-- Tabela rastreadores_config_plataformas (softruck)
ambiente_atual: sandbox
api_url_sandbox: https://api.apiary.softruck.com/v2
api_url_producao: https://api.softruck.com/v2
auth_type: oauth_jwt
suporta_posicao_tempo_real: true
suporta_historico_trajeto: true
suporta_acionamento_roubo: false
suporta_bloqueio: false
```

---

## Secrets Configurados

Os seguintes secrets Softruck estao configurados:
- `SOFTRUCK_PUBLIC_KEY`
- `SOFTRUCK_USERNAME`
- `SOFTRUCK_PASSWORD`
- `SOFTRUCK_ENTERPRISE_ID`

---

## Gaps Identificados

### Alta Prioridade

1. **Public Key Invalida:** O erro "Public key does not exist" indica que a chave publica configurada nao e reconhecida pela Softruck.

2. **Ausencia de Retry em Erro 401:** Quando o token expira e uma chamada retorna 401, o sistema deveria:
   - Detectar o erro 401
   - Forcar refresh do token (`force_refresh: true`)
   - Tentar a chamada novamente

3. **Refresh Token Nao Utilizado:** O sistema armazena o `refresh_token` mas nunca o utiliza para renovar o token - sempre faz login completo.

### Media Prioridade

4. **Logs de Autenticacao Incompletos:** Nao ha registro na tabela `rastreadores_logs` quando ocorre erro de autenticacao.

5. **Ausencia de Comandos de Bloqueio:** A API Softruck suporta comandos, mas o sistema nao implementa.

---

## Plano de Correcoes

### Fase 1: Corrigir Erro de Public Key (Configuracao)

O usuario deve verificar:
1. Se a `SOFTRUCK_PUBLIC_KEY` esta correta no Supabase
2. Se a conta Softruck esta ativa
3. Se as credenciais `SOFTRUCK_USERNAME` e `SOFTRUCK_PASSWORD` estao corretas

### Fase 2: Implementar Retry em Erro 401

**Arquivos a modificar:**
- `supabase/functions/rastreador-posicao/index.ts`
- `supabase/functions/posicao-veiculo/index.ts`
- `supabase/functions/rastreador-historico/index.ts`
- `supabase/functions/sync-rastreadores/index.ts`

**Logica proposta:**

```typescript
async function chamadaSoftruckComRetry(
  supabaseUrl: string,
  supabaseKey: string,
  url: string,
  options: RequestInit,
  tentativas: number = 2
): Promise<Response> {
  for (let i = 0; i < tentativas; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 401) {
      console.warn(`[Softruck] Erro 401, tentativa ${i + 1}/${tentativas}`);
      
      if (i === tentativas - 1) {
        throw new Error('Token Softruck invalido apos renovacao');
      }
      
      // Forcar refresh do token
      const authResponse = await fetch(
        `${supabaseUrl}/functions/v1/rastreador-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ plataforma: 'softruck', force_refresh: true })
        }
      );
      
      const authData = await authResponse.json();
      if (!authData.success) {
        throw new Error('Falha ao renovar token');
      }
      
      // Atualizar token nas options
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${authData.token}`,
      };
      
      continue;
    }
    
    return response;
  }
  
  throw new Error('Erro inesperado');
}
```

### Fase 3: Implementar Uso de Refresh Token

**Arquivo:** `supabase/functions/rastreador-auth/index.ts`

Adicionar logica para usar refresh_token antes de fazer login completo:

```typescript
// Verificar se tem refresh_token valido
const { data: tokenComRefresh } = await supabase
  .from('rastreadores_tokens_cache')
  .select('refresh_token')
  .eq('plataforma', 'softruck')
  .not('refresh_token', 'is', null)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (tokenComRefresh?.refresh_token) {
  try {
    // Tentar usar refresh_token primeiro
    const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'public-key': publicKey,
      },
      body: JSON.stringify({ refresh_token: tokenComRefresh.refresh_token })
    });
    
    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      return { token: data.data.token, refresh_token: data.data.refresh_token };
    }
  } catch (e) {
    console.log('Refresh falhou, fazendo login completo');
  }
}

// Fallback para login completo
return await authSoftruck(baseUrl);
```

### Fase 4: Adicionar Logs de Erro de Autenticacao

Registrar falhas de autenticacao na tabela `rastreadores_logs`:

```typescript
catch (error) {
  // Log de erro de autenticacao
  await supabase
    .from('rastreadores_logs')
    .insert({
      plataforma: 'softruck',
      operacao: 'autenticacao',
      status: 'erro',
      erro_mensagem: error.message,
    });
    
  throw error;
}
```

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/rastreador-auth/index.ts` | Adicionar uso de refresh_token e logs de erro |
| `supabase/functions/rastreador-posicao/index.ts` | Adicionar retry em erro 401 |
| `supabase/functions/posicao-veiculo/index.ts` | Adicionar retry em erro 401 |
| `supabase/functions/rastreador-historico/index.ts` | Adicionar retry em erro 401 |
| `supabase/functions/softruck-api/index.ts` | Adicionar retry em erro 401 |
| `supabase/functions/sync-rastreadores/index.ts` | Adicionar retry em erro 401 |

---

## Novo Arquivo a Criar

```text
supabase/functions/_shared/softruck-utils.ts
```

Modulo compartilhado com funcoes de retry e autenticacao para evitar duplicacao de codigo.

---

## Checklist de Verificacao

Apos implementacao, confirmar:

- [ ] Endpoint `POST /v2/auth/login` chamado corretamente
- [ ] Header `public-key` presente em todas requisicoes
- [ ] `refresh_token` armazenado e utilizado para renovacao
- [ ] Token Bearer repassado em todas chamadas subsequentes
- [ ] Erro 401 dispara renovacao automatica com retry
- [ ] Logs de erro de autenticacao registrados
- [ ] Alternancia sandbox/producao funcionando

---

## Teste Recomendado

Antes de implementar as correcoes, o usuario deve:

1. **Verificar credenciais no painel Softruck:**
   - Confirmar que a Public Key esta correta
   - Confirmar que username/password estao ativos
   - Verificar se a conta nao esta bloqueada

2. **Atualizar secrets no Supabase se necessario:**
   - Navegar para Edge Functions > Secrets
   - Atualizar `SOFTRUCK_PUBLIC_KEY` com valor correto

3. **Testar conexao novamente:**
   - Usar o botao "Testar Conexao" no painel de Monitoramento

