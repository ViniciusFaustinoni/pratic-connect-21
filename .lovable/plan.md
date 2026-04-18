

## Causa raiz (3 telas, mesmo padrão)

Verificado nos arquivos: **Associados**, **Cotações** e **Rastreadores** sofrem da mesma família de bugs. O sintoma "página recarrega a cada letra" vem de `if (isLoading) return <Spinner>` no topo dos componentes — desmonta o `<Input>` toda vez que `queryKey` muda. Somado a isso, normalização de CPF/telefone/placa é inconsistente, então buscas válidas não retornam.

## Correção unificada

### A. Fluidez (todos os 3)
**Padrão único** aplicado em `Associados.tsx`, `Cotacoes.tsx` e `Rastreadores.tsx`:
1. Remover `if (isLoading) return <Loader2/>` no topo.
2. Manter header + filtros + `<Input>` sempre montados.
3. Spinner/skeleton vai **dentro** do corpo da tabela (`isFetching && !data.length`).
4. Estado local `searchInput` controla o input; `useDebounce(searchInput, 350)` alimenta o filtro.
5. Hooks recebem `placeholderData: keepPreviousData` → `isLoading` não volta a `true` em refetches; tabela faz fade sem desmontar.

### B. Busca encontrar dados reais
Helper único **`src/lib/buscaUtils.ts`** (novo):
```ts
normalizarBusca(termo) → { 
  digits,            // só números
  cpfFormatado,      // 000.000.000-00 quando 11 dígitos
  telefoneFormatado, // (00) 00000-0000 quando 10/11 dígitos
  placa              // [A-Z0-9] uppercase
}
```

Aplicado em:
- **`useAssociados.ts`**: aceita CPF cru OU formatado (`cpf.eq.<digits>,cpf.eq.<formatado>`); telefone idem; placa 4-8 chars normalizada.
- **`useRastreadores.ts`**: corrige o `.or(..., { referencedTable })` malformado (HTTP 400 silencioso identificado antes); aplica mesmo helper; adiciona `.limit()` em subqueries de placa para não estourar URL; debounce upstream.
- **`useCotacoes.ts`**: adiciona parâmetro `searchTerm` server-side com `or(numero.ilike, leads.nome.ilike, veiculo_placa.ilike, veiculo_marca.ilike, veiculo_modelo.ilike)` — hoje busca é só client-side sobre lote inicial e perde registros antigos.

### Escopo
3 telas, 1 helper novo, sem mudança de schema, sem nova dependência.

## Arquivos
- `src/lib/buscaUtils.ts` (novo)
- `src/pages/cadastro/Associados.tsx`
- `src/pages/vendas/Cotacoes.tsx`
- `src/pages/cadastro/Rastreadores.tsx`
- `src/hooks/useAssociados.ts`
- `src/hooks/useCotacoes.ts`
- `src/hooks/useRastreadores.ts`

## Validação (login admin@teste.com)
1. **Associados**: digitar `daniel` letra a letra → input mantém foco, sem flash de spinner em tela cheia. Buscar `21997844853`, `12345678900`, `123.456.789-00`, `PZU3B88`, `pzu-3b88` → todos retornam.
2. **Rastreadores**: buscar placa com e sem hífen → encontra; Network mostra 200 (não mais 400 silencioso).
3. **Cotações**: buscar cotação antiga (fora do lote inicial de 100) → aparece via server-side.
4. **DevTools Network**: ≤1 request por pausa de 350 ms em todas as telas.

