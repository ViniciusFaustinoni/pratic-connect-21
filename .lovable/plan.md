

# Integrar elegibilidade de veículos no cotador

## Alterações

### 1. `src/hooks/usePlanosCotacao.ts`

**Interface `CalcularPlanosParams`** — adicionar campos opcionais:
```typescript
marca?: string;
modelo?: string;
```

**Nova query** — buscar `plano_elegibilidade_modelos` (junto das queries existentes, ~linha 132):
```typescript
const { data: elegibilidadeData, isLoading: elegibilidadeLoading } = useQuery({
  queryKey: ['plano_elegibilidade_modelos'],
  queryFn: ...,
  staleTime: 5 * 60 * 1000,
});
```

**Nova função** `verificarElegibilidadeModelo` — conforme especificação do usuário (case-insensitive, sem config = aceita tudo, modelo não encontrado na lista = negado).

**Filtro no loop** (~linha 216, após filtro de `blocked_categories`) — se marca/modelo/ano estiverem presentes e elegibilidadeData carregado, excluir planos com resultado `'negado'`.

**Interface `PlanoCotacao`** — adicionar campo `elegibilidadeStatus?: 'aprovado' | 'limitado' | 'negado'`.

**No push do plano** (~linha 318) — calcular e incluir `elegibilidadeStatus`.

**isLoading** — incluir `elegibilidadeLoading` no retorno.

**Deps do useMemo** — adicionar `elegibilidadeData`.

### 2. `src/components/cotacoes/CotacaoFormDialog.tsx`

**Chamada do hook** (~linha 293) — passar `marca` e `modelo`:
```typescript
marca: getMarcaNome() || undefined,
modelo: getModeloNome() || undefined,
```

Problema: `getMarcaNome()` é definida na linha 829 (após o hook na 293). Solução: extrair a lógica de resolução de nome em `useMemo` antes da chamada do hook.

**Badge "Aceitação com restrições"** (~linha 1668) — quando `plano.elegibilidadeStatus === 'limitado'`, exibir badge amarelo ao lado do nome.

### 3. `src/pages/vendas/Cotador.tsx`

**Chamada do hook** (~linha 298) — passar `marca` e `modelo` dos estados existentes:
```typescript
marca: marca || undefined,
modelo: modelo || undefined,
```

### 4. `src/pages/vendas/Cotacao.tsx`

**Chamada do hook** (~linha 109) — passar `marca` e `modelo` (variáveis já existentes no componente).

### 5. `src/components/cotacao/PlanoCardCotacao.tsx`

Adicionar suporte a `elegibilidadeStatus` no tipo `PlanoCotacao` — exibir badge amarelo "Aceitação com restrições" quando `limitado`.

## Resumo
- 1 nova query (cache 5min, busca tudo de uma vez)
- 1 função de verificação pura (sem side effects)
- Filtro aditivo após todos os filtros existentes
- Nenhum filtro existente removido ou alterado
- 3 callers atualizados para passar marca/modelo
- Badge visual para planos com status "limitado"

