

## Plano: Double-check de marca com aliases + fallback contains no matching de modelo

### Problema
O banco tem marcas inconsistentes (`VW` e `VOLKSWAGEN`, `MERCEDES` e `MERCEDES-BENZ`, `CAOA CHERY`). O Cotador normaliza marca para `Volkswagen`, mas a comparação em `verificarElegibilidadeModelo` faz `"VOLKSWAGEN" === "VW"` → falha → todos negados.

Além disso, o matching de modelo por `startsWith` falha quando o banco tem nome mais longo que a API ou variação no meio (ex: `C3 PICASSO` vs `PICASSO C3`).

### Solução — arquivo único: `src/hooks/usePlanosCotacao.ts`

#### 1. Mapa de aliases de marca (antes da função `verificarElegibilidadeModelo`)

```typescript
const MARCA_ALIASES: Record<string, string> = {
  'VW': 'VOLKSWAGEN',
  'GM': 'CHEVROLET',
  'MERCEDES': 'MERCEDES-BENZ',
  'CAOA CHERY': 'CHERY',
  'CHERY': 'CAOA CHERY', // bidirecional
  'CITROËN': 'CITROEN',
};

function normalizarMarcaElegibilidade(marca: string): string {
  const upper = marca.trim().toUpperCase();
  return MARCA_ALIASES[upper] || upper;
}
```

#### 2. Matching de marca com double-check (dentro de `verificarElegibilidadeModelo`)

Substituir a comparação exata por normalização com aliases em ambos os lados:

```typescript
const marcaNormAPI = normalizarMarcaElegibilidade(veiculo.marca);

// Na busca de regra:
const marcaMatch = normalizarMarcaElegibilidade(r.marca) === marcaNormAPI;
```

#### 3. Matching de modelo com fallback `includes` (double-check)

Substituir o matching atual por 3 níveis:

```typescript
const modeloBanco = r.modelo.trim().toUpperCase();

// Nível 1: prefixo (mais comum)
const prefixMatch = modeloAPI.startsWith(modeloBanco) 
  || modeloBanco.startsWith(modeloAPI);

// Nível 2: fallback contains (nome menor dentro do maior)
const containsMatch = modeloAPI.includes(modeloBanco) 
  || modeloBanco.includes(modeloAPI);

const modeloMatch = prefixMatch || containsMatch;
```

Isso resolve:
- `"VOYAGE"` (banco) dentro de `"VOYAGE 1.6 MSI"` (API) → match
- `"C3 PICASSO"` (banco) dentro de `"C3 PICASSO 1.6 FLEX"` (API) → match  
- `"HB20"` (banco) dentro de `"HB20 1.0 COMFORT"` (API) → match
- Nomes invertidos ou abreviados → match via contains

#### 4. Priorizar regra mais específica

Ordenar `regrasDoPlano` por comprimento de modelo (desc) antes do `find`, para que `"C3 PICASSO"` seja encontrado antes de `"C3"`:

```typescript
const regrasOrdenadas = [...regrasDoPlano].sort(
  (a, b) => b.modelo.length - a.modelo.length
);
```

### Impacto
- `VW` ↔ `VOLKSWAGEN`: ambos normalizam para `VOLKSWAGEN` → match
- `MERCEDES` ↔ `MERCEDES-BENZ`: ambos normalizam para `MERCEDES-BENZ` → match
- Modelos com motorização/versão na API agora encontram a regra do banco
- Regra mais específica tem prioridade sobre genérica

