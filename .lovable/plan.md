

## Diagnóstico: Erro CORS na `autentique-create`

### Causa raiz

Existem **dois problemas**:

1. **Bug no código (causa do CORS)**: A variável `_startTime` é declarada como `const` dentro do bloco `try` (linha 177), mas referenciada no bloco `catch` (linha 870). Em JavaScript, `const` é block-scoped — ela **não existe** no `catch`. Quando a API Autentique retorna erro, o `catch` tenta usar `_startTime`, causa um `ReferenceError` que crasheia o handler antes de retornar a Response com CORS headers. Resultado: o browser vê resposta sem headers CORS e bloqueia.

2. **Erro da API Autentique (causa do 500)**: `unavailable_verifications_credits` — sua conta Autentique esgotou os créditos de verificação biométrica (PF_FACIAL). Este é um problema de billing na Autentique, não no código.

### Correção

**Arquivo**: `supabase/functions/autentique-create/index.ts`

- Mover `const _startTime = Date.now()` para **antes** do `try` (entre linhas 175-176), tornando-o acessível no `catch`
- Deploy da edge function

### Sobre o erro "unavailable_verifications_credits"

Mesmo após a correção do código, a criação de documentos com biometria facial continuará falhando até que os créditos de verificação sejam recarregados no painel da Autentique. A diferença é que após a correção, o erro será tratado corretamente (exibido como mensagem amigável em vez de erro CORS).

### Escopo
- 1 linha movida em 1 arquivo
- 1 deploy de Edge Function

