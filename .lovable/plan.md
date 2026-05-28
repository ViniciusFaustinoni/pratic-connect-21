## Diagnóstico

Ao investigar o preview com o usuário logado em `/dashboard` (admin@teste.com — Diretor), encontrei **duas causas independentes** que se somam e explicam tanto a "Aprovação do Monitoramento não carregar" quanto a lentidão geral. As duas precisam ser corrigidas.

### 1. Loop de remount da árvore (causa primária da lentidão)

Os logs do console mostram, **uma vez por segundo, em loop**:

```
SIGNED_IN  (currentUserId: undefined)
INITIAL_SESSION (currentUserId: 4218616b)
[ProtectedRoute] Usuário autenticado sem profile, redirecionando para login
Multiple GoTrueClient instances detected
[pendencias-documentos-rt] SUBSCRIBED <novo channel ID a cada ciclo>
```

O channel id do PendenciasBell muda a cada ciclo → a árvore React inteira está sendo desmontada/remontada. O `AuthProvider` é remontado, refaz `onAuthStateChange` (emite `SIGNED_IN`+`INITIAL_SESSION`), refaz fetch de profile/perfis, e dispara reinscrição de todos os realtime channels, refetch de TanStack Query, recriação do `publicSupabase` (daí o "Multiple GoTrueClient" recorrente).

**Causa raiz:** o `ProtectedRoute` está vendo `loading=false` + `user!=null` + `profile==null` em uma janela muito curta após o `SIGNED_IN` (antes do `setProfile()` propagar), e dispara `<Navigate to="/auth">`. O `/auth` por sua vez detecta sessão e devolve para `/dashboard`. Ciclo. Cada volta gera um Suspense remount → spinner → fetch tudo de novo → skeletons que nunca somem.

Confirmação:
- O profile do user existe no banco (`profiles.user_id = 4218616b-…`, tipo=funcionario, bloqueado=false), as policies permitem `user_id = auth.uid()` — a query funciona.
- A leitura é assíncrona e o `setProfile` acontece **depois** de `setLoading(false)` em alguns caminhos do `loadUserData`, e o branch "Mesmo usuário já carregado" também faz `setLoading(false)` antes de garantir `profile != null`.

### 2. Tela "Aprovações do Monitoramento" — queries pesadas sem paginação

`useAprovacoesMonitoramentoBreakdown` (usado pelo badge do sidebar **e** pelas abas) roda 6 queries em paralelo a cada 60s e a cada navegação. A do `associados` puxa **todos** os `servicos` com `status=concluida` (sem `limit`) com 3 joins aninhados, depois faz um segundo `in()` em `vistorias`. A de `liberacaoSuspensao` puxa todos os `veiculos` suspensos + todos os contratos em `in(veiculo_id, …)`.

Cada remount do bloco anterior **reexecuta tudo isso**. É por isso que os skeletons das abas Aprovação de Associados / Liberação de Suspensão / Processos Operacionais não resolvem visualmente — a UI nunca chega ao estado estável antes do próximo remount.

## Plano de correção

### Passo 1 — Estancar o loop de redirect (prioridade máxima)

Em `src/components/ProtectedRoute.tsx`:
- Adicionar uma janela de tolerância: enquanto `user && !profile && !error`, considerar o estado como ainda carregando e mostrar o loader em vez de `<Navigate to="/auth">`. Só redirecionar quando houver sinalização explícita de falha (timeout do AuthContext já existente, ou flag nova `profileLoadFailed`).

Em `src/contexts/AuthContext.tsx`:
- No `loadUserData`, ordenar `setProfile()`/`setPerfis()` **antes** de `setLoading(false)` (já está, mas garantir que o branch "mesmo usuário já carregado" no `onAuthStateChange` não force `loading=false` quando ainda não há profile carregado).
- Expor um `profileLoadFailed: boolean` que só vira true após o timeout de 15s ou erro real — esse é o sinal que o `ProtectedRoute` usa para finalmente redirecionar.

Resultado esperado: cessa o `Navigate → /auth → /dashboard → remount`. O `AuthProvider` permanece montado e os channels deixam de reinscrever. O "Multiple GoTrueClient" some.

### Passo 2 — Aliviar `useAprovacoesMonitoramentoBreakdown`

Em `src/hooks/useAprovacoesMonitoramentoCount.ts`:
- Substituir a query de `associados` por um `count` no servidor (RPC `select count(*) from servicos … where …`) em vez de baixar todas as linhas e filtrar no cliente. Mesma coisa para `liberacaoSuspensao`.
- Aumentar `refetchInterval` de 60s para 5 min (badges não precisam de granularidade fina) e marcar `refetchOnWindowFocus: false`.
- Manter um único `useQuery` compartilhado (já é, via key estável) e usar nas abas apenas o `data?.associados` etc. para o badge — os contadores totais vêm desse hook único; as listas detalhadas continuam com seus próprios hooks, que já paginam.

### Passo 3 — Reduzir thrash de realtime

Em `PendenciasDocumentosBell` (e demais subscribers de canais) — após o passo 1 isso deixa de remontar, mas vou conferir que o `useEffect` use `cleanup` correto e não recrie o channel a cada render por dependências instáveis.

### Passo 4 — Validação

1. Abrir `/dashboard` e confirmar no console: **apenas 1** `SIGNED_IN`, **1** `INITIAL_SESSION`, **1** `Multiple GoTrueClient` (esperado, vem do `publicClient`), e **um único** `SUBSCRIBED` por canal.
2. Navegar para `Monitoramento → Aprovações do Monitoramento` e confirmar que as abas Aprovação de Associados, Liberação de Suspensão e Processos Operacionais saem do skeleton em <2s.
3. Conferir tempo total das queries do badge no painel network (target: <500ms por count vs. atual de baixar todos os `servicos concluida`).

### Arquivos a alterar
- `src/components/ProtectedRoute.tsx` — janela de tolerância antes do redirect.
- `src/contexts/AuthContext.tsx` — flag `profileLoadFailed`, garantir ordem `setProfile → setLoading(false)` em todos os branches.
- `src/hooks/useAprovacoesMonitoramentoCount.ts` — usar `count` server-side, refetch 5 min, sem refetch on focus.
- (opcional) Verificar `PendenciasDocumentosBell` e canal `auth-user-roles-${user.id}` por dependências instáveis.

### Nada que NÃO será mexido
- Lógica de negócio das abas (filtros, regras de aprovação, edges).
- RLS, schemas, migrations.
- `publicClient.ts` (o aviso "Multiple GoTrueClient" é normal — uma instância no `client.ts`, outra no `publicClient.ts` — só vira problema porque o loop o repete).
