## Problema

O toast `Acquiring an exclusive Navigator LockManager lock 'lock:sb-…-auth-token' timed out waiting 10000ms` aparece ao clicar **Criar Cotação** no modal de Substituição de Placa (e pode ocorrer em qualquer fluxo autenticado depois que dispara). A cotação foi calculada normalmente; quem falha é o cliente Supabase de auth.

Hoje, durante os 10 s em que o lock fica esperando, o botão "Criar Cotação" **não dá nenhum feedback visual** — o operador acha que o clique não pegou e clica de novo, agravando o problema.

## Causa raiz

`src/integrations/supabase/client.ts` envolve o `fetch` global com `fetchWithTimeout` que **aborta requests de `/auth/v1/` após 15 s** (linhas 35–93). Quando essa aborção acontece:

1. O `@supabase/auth-js` estava segurando o `navigator.locks` lock `sb-…-auth-token` durante o request.
2. O abort externo derruba o fetch mas o lock fica **preso** até a aba fechar.
3. Qualquer chamada subsequente de auth (`getSession`, refresh automático, etc.) espera 10 s e lança o erro.

O modal de Substituição é apenas onde aparece porque o handler de criar encadeia `createCotacao.mutateAsync` → `chamarEdge` → `supabase.auth.getSession()` (linha 1996 de `CotacaoFormDialog.tsx`).

## Correção

### 1. `src/integrations/supabase/client.ts` — não abortar requests de `/auth/v1/`

Remover o timeout para chamadas de auth. O risco de uma chamada pendurada é menor do que o de wedgear o lock. Para `/auth/v1/` o navegador já tem timeout de TCP próprio.

```ts
const fetchWithTimeout: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input as Request).url;
  const isAuthCall = url.includes('/auth/v1/');

  // Auth: sem AbortController nosso — deixa o supabase-js controlar o ciclo
  // de vida do lock. Abortar /auth/v1/ wedgeia o navigator.locks e quebra
  // qualquer chamada autenticada subsequente até a aba fechar.
  if (isAuthCall) {
    const start = performance.now();
    let status = 0;
    try {
      const res = await fetch(input, init);
      status = res.status;
      // mantém o bloco existente de 401 → forceLocalLogout
      return res;
    } finally {
      recordCall({ url, method, status, durationMs: performance.now() - start, isTimeout: false });
    }
  }

  // Demais endpoints (REST/Edge): mantém o timeout de 25 s como hoje.
};
```

### 2. `src/integrations/supabase/client.ts` — usar `processLock` (defesa em profundidade)

`@supabase/supabase-js` exporta `processLock`, um lock in-memory single-tab que **não usa `navigator.locks`**, eliminando completamente a classe inteira de bug.

```ts
import { createClient, processLock } from '@supabase/supabase-js';

export const supabase = createClient<LooseDatabase>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    lock: processLock,
  },
  global: { fetch: fetchWithTimeout },
});
```

### 3. `src/components/cotacoes/CotacaoFormDialog.tsx` — feedback de carregamento no botão "Criar Cotação"

Hoje o botão **não muda de estado** enquanto o submit está rodando. Quando o erro do lock acontece, o operador espera 10 s sem ver nada se mexer e tende a clicar de novo.

Mudanças mínimas (sem alterar lógica de negócio):

- Derivar `const isSubmitting = createCotacao.isPending || updateCotacao.isPending;` (já existem as mutations no escopo).
- No botão de confirmação dentro do `ConfirmDialog` ("Criar Cotação" / "Atualizar Cotação"):
  - `disabled={isSubmitting}`
  - Renderizar `<Loader2 className="h-4 w-4 animate-spin" />` + label "Criando cotação…" / "Atualizando…" enquanto `isSubmitting`.
- O label e o ícone do botão principal "Criar Cotação" (no rodapé do modal) também ganham `disabled={isSubmitting}` + spinner, evitando duplo clique antes da abertura do confirm dialog quando o submit já está em curso.
- Reaproveitar o `Loader2` de `lucide-react` que já é importado em vários pontos do projeto — sem nova dependência.
- A animação é via Tailwind `animate-spin` (utilitário nativo). Não precisa de keyframe novo.

Comportamento resultante: clicou → botão fica `disabled` com spinner + texto "Criando cotação…" até o `toast.success` ou o `toast.error`. Operador entende imediatamente que o sistema está trabalhando.

## O que NÃO é a causa (descartado)

- Não é o `usePlanosCotacao` nem o catálogo: a grade do plano renderizou (Select Basic R$ 347,80 visível no screenshot).
- Não é a edge `vincular-cotacao-substituicao`: o vínculo é feito por `supabase.from('solicitacoes_substituicao_placa').update(...)` direto (linha 2119), não por edge function.
- Não é múltiplas instâncias de `createClient`: só existe uma (`src/integrations/supabase/client.ts`).

## Validação

1. **Recarregar a aba** (libera o lock atual preso) e abrir a substituição da placa **RVW1A14 → LTB4J74** novamente.
2. Clicar **Criar Cotação** → o botão deve mostrar imediatamente o spinner + "Criando cotação…", criar a cotação, redirecionar para `/vendas/cotacoes?abrir=…` e mostrar o toast verde.
3. Repetir 3× sem recarregar para confirmar que o lock não wedgeia mais.
4. Conferir no console que não há nenhum `Acquiring an exclusive Navigator LockManager lock` durante a sessão.

## Arquivos tocados

- `src/integrations/supabase/client.ts` — correção do lock (itens 1 e 2).
- `src/components/cotacoes/CotacaoFormDialog.tsx` — animação de carregamento no botão (item 3).

## Fora deste plano

- O assunto separado dos planos "Até 30 Mil" aparecendo em FIPE alto fica para a próxima ação — sem mistura com este hotfix.
