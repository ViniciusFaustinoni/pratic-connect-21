

## Plano: Corrigir filtro de elegibilidade em `usePlanosCotacao.ts`

Três correções cirúrgicas no arquivo `src/hooks/usePlanosCotacao.ts`:

### 1. Aliases de marca (linhas 199-206)

Corrigir o alias `CAOA CHERY → CHERY` que está invertido e cria loop:

```typescript
const MARCA_ALIASES: Record<string, string> = {
  'VW': 'VOLKSWAGEN',
  'GM': 'CHEVROLET',
  'MERCEDES': 'MERCEDES-BENZ',
  'CHERY': 'CAOA CHERY',
  'CITROËN': 'CITROEN',
};
```

Na comparação (linha 233), normalizar **ambos os lados** e manter fallback com valor original:

```typescript
const marcaNormBanco = normalizarMarcaElegibilidade(r.marca);
const marcaMatch = marcaNormBanco === marcaNormAPI 
  || r.marca.trim().toUpperCase() === veiculo.marca.trim().toUpperCase();
```

### 2. Matching de modelo (linhas 236-241)

Adicionar função de normalização que remove parênteses, suporte a wildcard, e fallback por primeira palavra:

```typescript
function normalizarModeloElegibilidade(modelo: string): string {
  return modelo.trim().toUpperCase()
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

No `.find()`:

```typescript
const modeloBanco = normalizarModeloElegibilidade(r.modelo);
const modeloAPIClean = normalizarModeloElegibilidade(veiculo.modelo);

// Wildcard
if (modeloBanco.startsWith('TODOS')) return true; // (dentro do find, como condição de match)

// 3 níveis
const prefixMatch = modeloAPIClean.startsWith(modeloBanco) || modeloBanco.startsWith(modeloAPIClean);
const containsMatch = modeloAPIClean.includes(modeloBanco) || modeloBanco.includes(modeloAPIClean);
const baseBanco = modeloBanco.split(' ')[0];
const baseMatch = baseBanco.length >= 2 && (
  modeloAPIClean.startsWith(baseBanco + ' ') || modeloAPIClean === baseBanco
);
const modeloMatch = prefixMatch || containsMatch || baseMatch;
```

### 3. Remover hard gate (linhas 371-380)

Remover o `continue` do bloco `negado`. O plano permanece nos resultados com `elegibilidadeStatus: 'negado'`, e o badge visual existente no `PlanoCardCotacao` passa a aparecer:

```typescript
if (elegibilidadeStatus === 'negado') {
  negados.push({ ... });
  // sem continue
}
```

### Resumo de impacto
- Arquivo editado: apenas `src/hooks/usePlanosCotacao.ts`
- VW ↔ VOLKSWAGEN: match via alias
- KA (NOVO) → KA → match com "KA SE 1.0"
- TODOS OS MODELOS → wildcard → aceita qualquer modelo
- Planos negados aparecem com badge visual em vez de sumir

