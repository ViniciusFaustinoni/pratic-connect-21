

# Plano: Acoplamento do Adicional APP

## Resumo

Inserir configuração `adicional_app` no banco e acoplar lógica de resolução de preço para planos de aplicativo em 4 hooks, usando funções utilitárias compartilhadas. Nenhum código existente será removido.

## PARTE 1 — Migration SQL

Inserir `adicional_app = '35.90'` na tabela `configuracoes` (com `ON CONFLICT DO NOTHING`).

## PARTE 2 — Utilitário compartilhado (novo arquivo)

Criar `src/utils/precoApp.ts` com duas funções puras:

```typescript
// resolverTipoUsoQuery: determina qual tipo_uso usar na busca
// resolverPrecoApp: aplica adicional_app se necessário
```

Regras implementadas:
- **SP + aplicativo** → busca `particular`, retorna direto (sem adicional)
- **select-one + RJ/Lagos + aplicativo** → busca `aplicativo`, retorna direto
- **select/lancamento + RJ/Lagos + aplicativo** → busca `particular`, soma `adicionalApp`
- **Demais** → busca `particular`, retorna direto

## PARTE 3 — Alterações nos hooks

### 3.1 `usePlanosCotacao.ts`
- Importar `useConfiguracaoNumero('adicional_app', 35.90)` (já disponível como hook React)
- Adicionar ao `useMemo` deps
- Na resolução de preço (linha ~205): usar `resolverTipoUsoQuery` para determinar `tipoUsoPricing`
- Após obter `valorMensal`: aplicar `resolverPrecoApp`

### 3.2 `useCotacaoAvancada.ts` (`usePlanosParaCotacao`)
- É uma `queryFn` async — buscar `adicional_app` do banco via query adicional no `Promise.all`
- Usar `resolverTipoUsoQuery` na busca de faixa (linha ~119)
- Aplicar `resolverPrecoApp` sobre o `valorMensal` resultante

### 3.3 `useCalcularCotacao.ts` (standalone, pasta hooks)
- É uma função async — buscar `adicional_app` junto com as outras configs no `Promise.all` (linha ~50)
- Usar `resolverTipoUsoQuery` e `resolverPrecoApp` na resolução de preço

### 3.4 `useCotacao.ts` (`encontrarFaixaMensalidade` + `useCalcularCotacao`)
- `encontrarFaixaMensalidade`: adicionar parâmetro `tipoUsoOverride` opcional
- Na chamada: passar `resolverTipoUsoQuery(linhaSlug, regiao, tipoUso)`
- Após obter resultado: aplicar `resolverPrecoApp`
- O `useCalcularCotacao` deste arquivo usa hooks React — usar `useConfiguracaoNumero`

## PARTE 4 — Validação dos 5 cenários

Após implementação, simularei mentalmente cada cenário e reportarei os valores esperados.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/...sql` | INSERT adicional_app |
| `src/utils/precoApp.ts` | **Novo** — funções utilitárias |
| `src/hooks/usePlanosCotacao.ts` | Acoplar resolução app |
| `src/hooks/useCotacaoAvancada.ts` | Acoplar resolução app |
| `src/hooks/useCalcularCotacao.ts` | Acoplar resolução app |
| `src/hooks/useCotacao.ts` | Acoplar resolução app |

Nenhum componente, página ou tabela de preço será criado/alterado.

