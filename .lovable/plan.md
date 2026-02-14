
# Corrigir Filtro por Marca do Veiculo no Dialog de Atribuicao

## Situacao Atual

O `AtribuirFornecedoresDialog.tsx` ja filtra oficinas, prestadores e auto centers pela marca do veiculo do sinistro (incluindo fornecedores GLOBAL). Os tres hooks (`useOficinas`, `usePrestadoresEvento`, `useAutoCenters`) ja implementam o filtro corretamente com a query:

```
marcas_atendidas.cs.{MARCA},marcas_atendidas.cs.{GLOBAL}
```

## Problema Encontrado

Ha um bug de case sensitivity na linha 56 do `AtribuirFornecedoresDialog.tsx`:

```typescript
const marcaVeiculo = veiculo?.marca?.toUpperCase() || '';
```

O `.toUpperCase()` converte "Chevrolet" para "CHEVROLET", mas os valores salvos em `marcas_atendidas` usam a grafia original da constante `MARCAS_VEICULOS` (ex: "Chevrolet", "Fiat", "Toyota"). O operador `cs` do PostgREST e case-sensitive para arrays de texto, entao "CHEVROLET" nao encontra "Chevrolet".

## Correcao

**Arquivo:** `src/components/sinistros/AtribuirFornecedoresDialog.tsx`

Remover o `.toUpperCase()` da linha 56:

```typescript
// Antes
const marcaVeiculo = veiculo?.marca?.toUpperCase() || '';

// Depois
const marcaVeiculo = veiculo?.marca || '';
```

Isso faz com que a marca seja passada exatamente como esta no cadastro do veiculo, garantindo correspondencia com os valores armazenados em `marcas_atendidas`.

Nenhuma outra alteracao necessaria -- os tres hooks e toda a logica de filtragem ja funcionam corretamente.
