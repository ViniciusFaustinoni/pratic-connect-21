

# Corrigir chamada a API Softruck - Trajeto Historico

## Problema

A API Softruck rejeita os parametros porque `URLSearchParams` codifica os colchetes nos nomes dos parametros:

- `filters[from]` vira `filters%5Bfrom%5D` -- API nao reconhece
- `filters[to]` vira `filters%5Bto%5D` -- API nao reconhece
- `filters[acc]` vira `filters%5Bacc%5D` -- API nao reconhece

Erro retornado pela API:
```
"query.filters.from" is not allowed
"query.filters.to" is not allowed
"query.filters.acc" must be of type object
```

## Solucao

Construir a query string manualmente em vez de usar `URLSearchParams`, preservando os colchetes sem encoding.

## Alteracao

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/rastreador-historico/index.ts` | Substituir `url.searchParams.set(...)` por construcao manual da URL (linhas 130-134) |

### Codigo atual (quebrado):
```typescript
const url = new URL(`${baseUrl}/vehicles/${vehicleId}/trajectories/`);
url.searchParams.set('filters[from]', inicio);
url.searchParams.set('filters[to]', fim);
url.searchParams.set('filters[acc]', 'all');
url.searchParams.set('limit', '100');
```

### Codigo corrigido:
```typescript
const queryParams = [
  `filters[from]=${encodeURIComponent(inicio)}`,
  `filters[to]=${encodeURIComponent(fim)}`,
  `filters[acc]=all`,
  `limit=100`,
].join('&');

const url = `${baseUrl}/vehicles/${vehicleId}/trajectories/?${queryParams}`;
```

Isso garante que os colchetes nos nomes dos parametros (`filters[from]`) fiquem intactos, enquanto apenas os valores sao codificados.

## Resultado esperado

A chamada a API Softruck retornara os dados do trajeto corretamente, e o card "Trajeto - 24h Antes do Sinistro" exibira o mapa com o percurso.

