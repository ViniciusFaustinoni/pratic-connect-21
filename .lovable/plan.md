## Causa raiz

A tela "Ocorreu um erro ao carregar a página — Minified React error #300" é o `AppErrorBoundary` (`src/components/app/AppErrorBoundary.tsx`) capturando um erro de render disparado **logo após o login do instalador/vistoriador**, antes de a hidratação do `profile`/`roles` terminar.

Sequência atual do bug:

1. Usuário envia credenciais em `/instalador/login`. `signIn()` resolve, `user` entra no `AuthContext` e o `useEffect` redireciona para `/instalador`.
2. No `AuthContext`, `loading` é desligado quando `loadUserData()` termina, mas existe uma **janela** em que `user` já está setado e `profile`/`perfis` ainda não chegaram (ou chegaram via cache parcial). `InstaladorGuard` só checa `loading` + `user` + `hasRole(...)` — nessa janela `hasRole` retorna `false` e/ou `profile` é `null`.
3. Com `profile=null`, `InstaladorLayout` monta e dispara `useTarefaAtual`, `useAlocacaoDiaria`, `useIniciarServico`, `useGarantirTurno(emServico)`, `useServicosRealtime`, etc. Alguns desses hooks calculam `emServico` / dependências derivadas que mudam **na próxima render** quando o `profile` chega — alterando a forma como subcomponentes (ex.: `JornadaStatusBar`, `BotaoIniciarServico`, `TarefaAtualCard`) retornam markup. Nessa transição, um componente devolve `undefined` (ou um array) em vez de elemento React → React lança **#300** ("A valid React element (or null) must be returned"), o `AppErrorBoundary` captura e mostra a tela mostrada no print.
4. No F5, `loading=true` desde o início; o Guard segura o render até `user`+`profile` chegarem juntos do cache local, então a primeira render já é consistente e nada quebra.

Ou seja: a raiz é o **Guard liberar o render do app do instalador antes do `profile` estar disponível**, somado à ausência de auto-recuperação do boundary contra erros transitórios de primeira render pós-login.

## Correção (raiz)

### 1. `InstaladorGuard` espera o `profile` (não só `user`)

Em `src/components/instalador/InstaladorGuard.tsx`:

- Trocar a condição `if (loading)` por `if (loading || (user && !profile))` — ou seja, enquanto houver sessão mas o profile ainda não carregou, manter o spinner "Carregando…".
- Manter o timeout de 15s já existente (passa a cobrir também `profile` ausente).
- Só avaliar `hasRole(...)` depois que `profile` existir, evitando o falso "Acesso Negado" e o flash de render parcial.

Resultado: `InstaladorLayout`/`InstaladorHome` nunca montam com `profile=null`, eliminando a race que dispara o #300.

### 2. `InstaladorLogin` aguarda profile antes de navegar

Em `src/pages/instalador/InstaladorLogin.tsx`, o `useEffect` que faz `navigate('/instalador')` passa a depender também de `profile?.id` (não só `user` + `hasRole`). Isso impede que o redirect dispare antes do `loadUserData` terminar.

### 3. `AppErrorBoundary` com auto-retry único + log de stack

Em `src/components/app/AppErrorBoundary.tsx`:

- No `componentDidCatch`, logar `error.stack` + `componentStack` + URL de decode do React (`https://react.dev/errors/300`) para que erros futuros fiquem rastreáveis no console do preview.
- Adicionar **auto-retry uma única vez** (via `sessionStorage` flag `app-eb-retried-at`) quando o erro for de primeira render pós-navegação: ao capturar, se ainda não tentou, força `window.location.reload()` automaticamente (mesma ação do botão), de forma que mesmo que a race ressurja em cenário futuro, o usuário não vê a tela quebrada. Bloqueia o auto-retry se já houve retry há menos de 60s para não entrar em loop.

### 4. Validação

- Login como vistoriador/instalador (admin de teste promovido a `instalador_vistoriador` num ambiente de QA, ou testar manualmente após deploy).
- Confirmar que após o submit aparece o spinner do Guard (não o `InstaladorHome` parcial) e em seguida o `InstaladorHome` completo, **sem** passar pela tela de erro.
- Forçar erro artificial em `InstaladorHome` para garantir que o auto-retry só dispara uma vez e que o boundary continua funcional.

## Arquivos a editar

- `src/components/instalador/InstaladorGuard.tsx` — espera `profile` antes de liberar children.
- `src/pages/instalador/InstaladorLogin.tsx` — redirect só após `profile` carregado.
- `src/components/app/AppErrorBoundary.tsx` — log detalhado + auto-retry idempotente.

Sem migrations. Sem mudança de regras de negócio.