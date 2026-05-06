
# Otimização Menu Comercial — Plano Fásico

Objetivo: derrubar FCP/DCL de **6.7s → ~2s**, fetches por carregamento de Cotações de **66 → ~8**, e DOM de tabelas grandes de **3.3k → <500 nodes**, sem perder funcionalidade.

---

## Fase 1 — Quick wins (alto impacto, baixo risco)

### 1.1 Lazy-mount do `CotacaoFormDialog`, `ContratoWizard`, `RelatorioInteligenteCotacoesDialog`

**Arquivo:** `src/pages/vendas/Cotacoes.tsx`

Hoje (linhas 30, 31, 47) são imports estáticos e o JSX (linhas 1155, 1222) renderiza esses dialogs **sempre**, mesmo com `open=false`. O `CotacaoFormDialog` (3094 linhas) executa ~32 `useQuery` no top-level, gerando 50+ fetches inúteis em toda visita.

Mudanças:
- Trocar imports por `React.lazy(() => import(...))` para `CotacaoFormDialog`, `ContratoWizard`, `RelatorioInteligenteCotacoesDialog`.
- Renderizar condicionalmente: `{showCotacaoForm && <Suspense fallback={null}><CotacaoFormDialog ... /></Suspense>}` (idem para `showContratoWizard` e o relatório IA).
- Lazy-import dinâmico de `gerarPdfCotacao` / `gerarPdfCotacaoComparativa` dentro do handler do botão (`await import('@/lib/gerarPdfCotacao')`).

Ganho: −50 fetches por visita; −238KB do bundle inicial.

### 1.2 Consolidar `configuracoes` em 1 hook batch

**Arquivos:**
- Novo: `src/hooks/useConfiguracoesAll.ts`
- Refatorar: `src/hooks/useConteudosSistema.ts` (linhas 9–24, base de todos `useConfiguracao*`)
- Tocar (consumir o cache, sem mudar API pública): `useFipeMenorAtivo.ts`, `useConfig0800.ts`, `useConfigLimitesVeiculo.ts`, `useConfigRastreador.ts`, `useTaxa*` em `useConteudosSistema`, `useCarencia*`, `useApiLeadsConfig.ts`.

Implementação:
```ts
// useConfiguracoesAll.ts
export function useConfiguracoesAll() {
  return useQuery({
    queryKey: ['configuracoes', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor');
      if (error) throw error;
      return Object.fromEntries((data ?? []).map(r => [r.chave, r.valor]));
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}
```

Em `useConteudosSistema.ts`, reescrever o `useConfiguracao` interno para ler do mapa carregado (selector pattern):
```ts
function useConfiguracao<T>(chave, parse, fallback) {
  const { data } = useConfiguracoesAll();
  return useMemo(() => {
    const v = data?.[chave];
    return v == null ? fallback : (parse(v) ?? fallback);
  }, [data, chave]);
}
```

Manter as assinaturas públicas (`useTaxaAdesaoPercentual()`, etc.) — apenas a fonte muda. Reduz **25 → 1** request.

### 1.3 Eliminar uso de `tabelas_preco_mensalidade` (DEPRECATED)

**Memory core:** “Never use legacy `tabelas_preco_mensalidade`”. Aparece em 7 arquivos `src/`.

Foco da Fase 1 (apenas quem é chamado pelo fluxo Comercial):
- `src/hooks/useCalcularCotacao.ts`
- `src/hooks/useCotacaoAvancada.ts`
- `src/hooks/usePlanos.ts`
- `src/utils/precoApp.ts`, `src/utils/fipeFaixa.ts`, `src/utils/regiaoMapping.ts`

Substituir por `entity_eligibility_rules` (já carregado por `useAllEligibilityRules`). Os arquivos `src/pages/diretoria/*` ficam para Fase 3 (telas administrativas, baixo tráfego).

### 1.4 Deduplicar `user_roles` / `profiles`

**Arquivos:**
- `src/contexts/AuthContext.tsx` (já busca `profiles` linha 72 e `user_roles` linha 98 — fonte única).
- Auditar consumidores: `src/hooks/usePermissions.ts`, `src/hooks/useUsuarios.ts`, `src/hooks/useVendedores.ts`. Garantir que **leem do `useAuth()`** em vez de novo `useQuery`.

Padrão:
```ts
const { profile, roles } = useAuth();
// nunca: supabase.from('user_roles').select(...).eq('user_id', user.id)
```

Se algum hook precisa de roles de **outros** usuários, aí sim faz query — mas para o usuário corrente, sempre via contexto.

### 1.5 Corrigir HEAD com CORS + HTTP 400 em `aprovacoes_fipe_menor`

**Arquivos:**
- Localizar com `rg -n "method:\s*'HEAD'|head\(\)" src/`. Os 4 endpoints (`contratos`, `servicos×2`, `error_reports`) provavelmente vêm de hooks de badge/contadores no sidebar.
- Substituir HEAD por `select('id', { count: 'exact', head: true })` do supabase-js (que já manda CORS correto), **ou** remover o badge se não for usado.
- `src/hooks/useAprovacoesFipeMenor.ts` — corrigir filtro que está produzindo HTTP 400 (provavelmente `.eq('coluna', undefined)` quando o usuário não é diretoria — adicionar guard `enabled:`).

### 1.6 Code-split garantido por rota

**Arquivo:** `src/App.tsx` — confirmar que **todas** as 12 rotas Comercial usam `lazy()`. Adicionar onde faltar:
```ts
const Cotacoes = lazy(() => import('@/pages/vendas/Cotacoes'));
```

### Entregáveis da Fase 1
- 6 PRs lógicos (1 por item).
- Smoke test manual: abrir cada uma das 12 rotas Comercial, verificar `network tab` < 15 fetches por rota e ausência de erros HTTP 400/CORS.

### Ganho esperado pós Fase 1
| Métrica | Hoje | Após Fase 1 |
|---|---|---|
| Fetches /vendas/cotacoes | 66 | ~12 |
| FCP/DCL médios | 6.7s | ~3.5s |
| Bundle inicial | ~5MB | ~4.5MB |
| Pressão Supabase | base | −70% |

---

## Fase 2 — Bugs visíveis (1 dia)

### 2.1 KPIs divergentes

**Arquivos:**
- `src/pages/vendas/Cotacoes.tsx` — `useCotacoesFunilCounts` (cards) vs `useCotacoesPaginadas` (tabela). Alinhar filtros de `vendedor_id`/`status`/aba ativa para ambas.
- `src/pages/cadastro/Associados.tsx` — cards mostram “1 Total / 0 Ativos” mas tabela tem dezenas. Igualar a fonte ou adicionar respeito a filtros.
- `src/pages/cadastro/Veiculos.tsx` — KPIs vazios. Mesma raiz.

Definir regra: **cards refletem o conjunto filtrado**, não global (mais intuitivo para o usuário).

### 2.2 Warnings `forwardRef` no console

**Arquivos:** `src/pages/cadastro/Veiculos.tsx`, `src/components/cadastro/VeiculoDetalhesModal.tsx`, `src/components/layout/AppLayout.tsx`. Envolver o componente filho com `React.forwardRef` quando passado como `asChild` para Radix.

---

## Fase 3 — Otimizações estruturais (3-5 dias)

### 3.1 Virtualização de tabelas

**Arquivos:**
- `src/components/cotacoes/CotacoesTable.tsx`
- `src/pages/cadastro/Associados.tsx` (tabela)
- `src/pages/cadastro/Veiculos.tsx` (tabela)

Adotar `@tanstack/react-virtual` (já no ecossistema) com `useVirtualizer({ count, estimateSize })`. Reduz DOM de 3318 → ~50 nodes visíveis.

### 3.2 Server-side pagination consistente

Garantir que toda listagem usa `range(from, to)` + `count: 'exact'` no header em vez de carregar 1000 linhas.

**Arquivos:** `useCotacoesPaginadas.ts` (já parcial), criar `useAssociadosPaginados.ts`, `useVeiculosPaginados.ts`.

### 3.3 Realtime sob demanda

**Arquivos:**
- `src/hooks/useCotacoesRealtime.ts` — adicionar `enabled: tabAtiva === 'em-andamento'` e garantir `supabase.removeChannel(channel)` no cleanup.

### 3.4 Migração restante de `tabelas_preco_mensalidade`

Limpar os arquivos `src/pages/diretoria/*` que ainda referenciam a tabela DEPRECATED.

---

## Fase 4 — Infra (opcional, >1 semana)

### 4.1 RPC `get_app_config()`
Materializar `configuracoes` em uma RPC SECURITY DEFINER cacheável + `Cache-Control: max-age=300` no PostgREST. Frontend continua usando `useConfiguracoesAll()`.

### 4.2 Índices Postgres
Validar via `EXPLAIN ANALYZE`:
- `CREATE INDEX IF NOT EXISTS idx_cotacoes_status_vendedor ON cotacoes(status, vendedor_id);`
- `CREATE INDEX IF NOT EXISTS idx_associados_status ON associados(status) WHERE status <> 'inativo';`
- `CREATE INDEX IF NOT EXISTS idx_veiculos_associado ON veiculos(associado_id);`

---

## Métricas finais esperadas

| Métrica | Hoje | Fase 1 | Fase 3 |
|---|---|---|---|
| Fetches `/vendas/cotacoes` | 66 | ~12 | ~8 |
| FCP/DCL | 6.7s | ~3.5s | ~2s |
| DOM `/cadastro/veiculos` | 3318 | 3318 | <500 |
| Pressão Supabase | base | −70% | −85% |

## Ordem de execução proposta para Fase 1

1. Item 1.1 (lazy-mount) — biggest single win, 30 min.
2. Item 1.2 (configuracoes batch) — 2-3h, requer testes em hooks dependentes.
3. Item 1.4 (dedup auth) — 1h.
4. Item 1.3 (remover deprecated) — 2h.
5. Item 1.5 (HEAD/CORS/HTTP400) — 1h.
6. Item 1.6 (code-split confirm) — 30 min.

Posso começar pelo 1.1 (impacto imediato visível) e seguir na ordem. Aprovar para iniciar?
