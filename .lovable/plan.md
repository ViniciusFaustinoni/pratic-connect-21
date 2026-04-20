
## Diagnóstico profundo do Supabase insalubre

### Conclusão principal
O problema atual não aponta primeiro para “plano pequeno do Supabase”. O sinal mais forte é de **indisponibilidade do serviço de Auth/DB** no projeto Supabase:

- `/auth/v1/token` está retornando **504** repetidamente.
- Os logs mostram o Auth falhando para falar com o Postgres: `failed to connect ... supabase_auth_admin database=postgres`, `context deadline exceeded`.
- Isso explica por que **ninguém consegue logar**.

Ou seja: **o ambiente está realmente inoperante agora**. Subir de plano pode até ajudar em cenários de carga real, mas **não resolve sozinho** uma arquitetura cliente que amplifica requisições nem corrige um Auth que já entrou em colapso.

### O que a análise do código mostra
Mesmo que a pane atual seja de infraestrutura, a aplicação hoje tem um desenho que **aumenta bastante a pressão** sobre Supabase:

#### 1. Autenticação com cascata de chamadas
- `AuthContext.tsx` faz:
  - `onAuthStateChange`
  - depois `getSession()`
  - depois busca `profiles`
  - depois busca `user_roles`
- Quando o Auth degrada, isso vira uma cascata de tentativas e loaders presos.
- O cliente Supabase está com `persistSession: true` e `autoRefreshToken: true`, então sessões antigas também disparam refresh automático.

#### 2. Retentativas manuais adicionais de sessão
Há lógica extra tentando “salvar” a sessão, o que piora quando o backend já está doente:
- `useAppResume.ts` chama `getSession()` e depois `refreshSession()` em `focus/visibilitychange`
- `InstaladorGuard.tsx` chama `refreshSession()` após 10s de loading

Isso transforma lentidão do Auth em **loop de refresh**.

#### 3. Muitos polls simultâneos
Há dezenas de hooks com `refetchInterval`, incluindo 30s, 15s e até 5s:
- `useEquipe.ts` → 30s
- `useInstalacoesContagem()` → 30s
- `useWhatsAppStatus.ts` → 30s
- `useTarefaAtual.ts` → **5s**
- vários outros hooks de monitoramento, acompanhamento, app, assistência e diretoria

Em especial, `useTarefaAtual.ts` além do polling a cada 5s ainda faz `supabase.auth.getUser()` dentro do `queryFn`, acrescentando custo ao Auth em cada ciclo.

#### 4. Realtime em paralelo com polling
Há vários canais realtime globais:
- `useNotificacoesRealtime`
- `useNotificacoesVendasRealtime`
- `useLeadsRealtime`
- `useFilasRealtime`
- `useRotasRealtime`
- outros por tela/detalhe

Em vários casos o realtime invalida queries amplas, e essas queries ainda têm polling. Resultado: **duplicação de atualização**.

#### 5. Queries pesadas e repetidas
Existem muitos padrões como:
- `select('*')`
- múltiplos `count: 'exact'`
- `refetchOnMount: 'always'`
- consultas em fan-out para montar dashboards/equipe

Exemplos críticos:
- `useEquipe.ts` faz várias queries sequenciais para montar um card simples
- `useDashboardCoordenador.ts` dispara vários `count exact`
- `useInstalacoes.ts` e derivados recarregam listas inteiras
- `useNotificacoesPreferencias.ts` ainda pode fazer `insert` automático no primeiro acesso

#### 6. Amplificação por layout global
No layout autenticado, recursos globais já sobem cedo:
- notificações realtime
- guardas de rota
- permissões baseadas em `app_roles_config`
- visibilidade de módulos

Isso aumenta custo logo após login e durante navegação.

### O que os indícios de consumo sugerem
Pelos prints enviados:
- **Storage** ~4.1 GB: não parece causa do colapso.
- **Compute hours** ~550h no período: mostra projeto sempre ativo, mas não prova gargalo.
- **Egress / Cached egress** com picos relevantes nos últimos dias: indica **muito tráfego de leitura/cache**, compatível com polling, realtime e recargas frequentes.

Resumo: há sim sinais de **cliente muito “falante”**, mas o quadro atual de “ninguém consegue logar” continua sendo compatível com **pane do Auth/Postgres**.

## Decisão: pagar plano maior ou simplificar?
### Minha recomendação
**Primeiro simplificar e estabilizar a arquitetura.**
Só depois medir novamente.

Hoje, subir de plano sem refatorar tende a:
- mascarar o problema por um tempo;
- manter desperdício de queries/egress;
- não atacar a causa do looping de login.

### Quando faria sentido plano maior
Só se, após simplificação:
- o Auth/DB continuar saturando em uso normal;
- houver concorrência real alta de usuários;
- dashboards/monitoramento precisarem de throughput que continue legítimo mesmo após corte de polling e consolidação de queries.

## Plano de correção recomendado

### Fase 1 — Estancar o colapso de login
1. Remover tentativas manuais redundantes de `refreshSession()` em foco/visibility/loading fallback.
2. Simplificar a inicialização do `AuthContext` para um único fluxo previsível.
3. Evitar que a tela de login fique presa indefinidamente em “Verificando sessão”.
4. Exibir estado explícito de backend indisponível quando o Auth estiver retornando timeout.
5. Reduzir chamadas extras logo após login:
   - evitar múltiplos `getUser/getSession/profile fetch` duplicados;
   - deixar o redirecionamento depender do contexto já carregado.

### Fase 2 — Cortar tráfego desnecessário
1. Auditar e reduzir polls:
   - 5s -> apenas onde estritamente operacional;
   - 30s -> 60/120s quando possível;
   - desligar polling em abas/telas invisíveis.
2. Remover `refetchOnMount: 'always'` de listas pesadas.
3. Trocar `select('*')` por colunas estritas.
4. Reduzir `count exact` em dashboards; consolidar métricas em queries únicas/RPCs.
5. Eliminar `auth.getUser()` dentro de hooks com polling recorrente.

### Fase 3 — Realtime mais cirúrgico
1. Subir canais realtime só nas telas que realmente precisam.
2. Parar de combinar polling + realtime para o mesmo dado, salvo fallback claro.
3. Trocar invalidações amplas por chaves exatas.
4. Evitar listeners globais para tabelas grandes quando o usuário não está usando o módulo.

### Fase 4 — Observabilidade e decisão financeira
1. Medir volume real por tela/módulo após a refatoração.
2. Levantar quais hooks mais consultam:
   - Auth
   - `profiles`
   - `user_roles`
   - `instalacoes`
   - `servicos`
   - `vistorias`
3. Revisar egress, cached egress e frequência de invalidations.
4. Só então decidir se o gargalo restante justifica upgrade de plano.

## Arquivos mais críticos para atacar primeiro
- `src/contexts/AuthContext.tsx`
- `src/integrations/supabase/client.ts`
- `src/hooks/useAppResume.ts`
- `src/components/instalador/InstaladorGuard.tsx`
- `src/pages/Auth.tsx`
- `src/pages/auth/Login.tsx`
- `src/hooks/useTarefaAtual.ts`
- `src/hooks/useEquipe.ts`
- `src/hooks/useInstalacoes.ts`
- `src/hooks/useDashboardCoordenador.ts`
- `src/hooks/useNotificacoesRealtime.ts`
- `src/hooks/useNotificacoesVendas.ts`
- `src/hooks/useFilasRealtime.ts`
- `src/hooks/useRotasRealtime.ts`

## Resultado esperado após a intervenção
- login volta a falhar de forma controlada quando o backend cair, sem loop eterno;
- queda grande no número de requests automáticos;
- menos pressão em Auth, PostgREST e Realtime;
- base objetiva para decidir se precisa de plano maior ou não.

## Resposta objetiva à sua dúvida
Com o que foi analisado até aqui:
- **sim, há excesso de requisições e arquitetura simplificável**;
- **não dá para concluir que o problema principal seja apenas falta de plano**;
- **eu priorizaria refatoração de auth + polling + realtime antes de recomendar upgrade**;
- se, depois disso, o Supabase ainda saturar, aí sim o upgrade passa a fazer sentido técnico.

## Próxima implementação sugerida
Na próxima etapa, a intervenção deve ser focada em:
1. estabilizar auth/login;
2. remover retries manuais de sessão;
3. reduzir polling crítico;
4. consolidar queries de monitoramento;
5. medir novamente o uso real do Supabase.
