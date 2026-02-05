
Objetivo
- Remover o “piscar” (flicker) na tela de login antes do redirecionamento, garantindo transição contínua e previsível.

Diagnóstico (com base no código atual)
1) O AuthContext está alternando `loading` para `false` dentro do `signIn()` mesmo quando o login foi bem-sucedido (finally).
   - Isso acontece ANTES do `onAuthStateChange` terminar de carregar `profile` + `perfis` via `loadUserData()`.
   - Resultado: o Login pode renderizar novamente (formulário/estado intermediário) por um instante, e depois voltar a “carregar”/redirecionar → sensação de flicker.

2) Em `src/pages/auth/Login.tsx`, o estado de “tela de loading” (showLoadingScreen) atualmente depende de:
   - `authLoading || (user && !profile)`
   - Porém, no intervalo logo após clicar “Entrar”, pode existir uma janela curta onde:
     - `isSubmitting === true` (usuário já clicou)
     - `authLoading` pode ir para `false` (por causa do signIn finally)
     - `user` ainda pode estar `null` (onAuthStateChange não refletiu ainda)
   - Nesse intervalo, o componente volta a renderizar o card de login (mesmo que desabilitado), e em seguida muda de novo para loading/redirect → flicker.

Estratégia de correção (mínima e robusta)
A) Ajustar o AuthContext para não “derrubar” o `loading` no sucesso do signIn
Arquivo: src/contexts/AuthContext.tsx

Mudança principal no método `signIn`:
- Manter `setLoading(true)` ao iniciar.
- Se houver erro no `supabase.auth.signInWithPassword`, aí sim:
  - setError(...)
  - setLoading(false)
  - return failure
- Se o login for bem-sucedido:
  - retornar success SEM executar `setLoading(false)` no finally
  - deixar o fluxo normal do AuthContext encerrar `loading` apenas quando `loadUserData()` concluir (que é onde profile/perfis são carregados)

Por que isso funciona
- O “loading” do AuthContext passa a refletir o carregamento real de autenticação + dados do usuário, e não apenas o término do request de login.
- Evita o estado intermediário “não carregando” antes do profile existir.

Observação importante
- Essa mudança deve ser aplicada com cuidado para não “prender” loading quando o signIn falhar. Por isso o setLoading(false) deve ocorrer explicitamente nos caminhos de erro (e não no finally).

B) Ajustar a tela de Login para cobrir o gap entre “clicou entrar” e “user/profile carregados”
Arquivo: src/pages/auth/Login.tsx

Mudança no cálculo de loading visual:
- Atualizar:
  - const showLoadingScreen = authLoading || (user && !profile);
- Para:
  - const showLoadingScreen = authLoading || isSubmitting || (user && !profile);

Além disso, manter o comportamento atual:
- Em caso de erro de login: `setIsSubmitting(false)` (já existe).
- Em caso de sucesso: manter `isSubmitting === true` até o redirect acontecer (já existe), garantindo que não renderize novamente o formulário.

Por que isso funciona
- Assim que o usuário clica “Entrar”, a UI entra em modo “carregando” imediatamente e não volta ao formulário.
- Mesmo que o AuthContext oscile rapidamente por qualquer motivo, o isSubmitting segura a tela estável.

C) (Opcional, se ainda houver flicker em outras telas de login)
Arquivos afetados potencialmente:
- src/pages/Auth.tsx (página /auth) atualmente tem fluxo próprio que faz fetch de profile e navigate manualmente.
- src/pages/app/AppLogin.tsx e src/pages/instalador/InstaladorLogin.tsx também dependem de `loading: authLoading`.

Se após A+B o problema persistir em /auth (ou em outros logins), vamos padronizar:
- Evitar `navigate()` manual após signIn nessas telas e passar a depender de `user + profile` via AuthContext (mesma ideia aplicada no /login).
- Introduzir um “loading local” (isSubmitting/loginLoading) que segura a UI estável até o redirect.

Plano de execução (passo a passo)
1) Editar `src/contexts/AuthContext.tsx`
   - Ajustar `signIn()` para:
     - Remover `setLoading(false)` do `finally` (ou condicionar para só rodar em falha).
     - Garantir `setLoading(false)` explicitamente em caso de `signInError`.
2) Editar `src/pages/auth/Login.tsx`
   - Alterar `showLoadingScreen` para incluir `isSubmitting`.
3) Verificação manual do fluxo (E2E)
   - Acessar /login
   - Logar com: admin@teste.com / admin@teste.com
   - Confirmar que após clicar “Entrar” a tela não volta ao formulário antes do redirect.
   - Confirmar que em credenciais inválidas o loading encerra e a mensagem aparece normalmente.
4) (Se necessário) Auditoria rápida em /auth
   - Reproduzir o mesmo cenário na rota /auth (caso ela seja usada por usuários).
   - Se houver flicker lá, padronizar o redirect para depender de `user+profile` e “segurar” UI com loading local.

Riscos e cuidados
- Se o `signIn` não “desligar loading” no sucesso, precisamos garantir que `loadUserData()` sempre finalize e faça `setLoading(false)` (hoje ele faz no finally).
- Se houver algum cenário em que o onAuthStateChange não dispare (raro), o `getSession()` na inicialização ainda existe; mas como signIn é uma ação explícita, o onAuthStateChange normalmente dispara. A checagem E2E vai validar.

Critério de pronto (Definition of Done)
- Após clicar “Entrar”, o usuário vê uma transição contínua (spinner/tela carregando) até o redirecionamento, sem reaparecer o card de login.
- Em caso de erro (senha inválida etc.), o usuário volta ao formulário sem travar em loading.
