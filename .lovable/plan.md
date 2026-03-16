

## Plano: Corrigir filtro de elegibilidade em `usePlanosCotacao.ts`

Três edições cirúrgicas no mesmo arquivo:

### Edição 1 — Aliases de marca (linhas 199-206)

Corrigir o alias `CAOA CHERY → CHERY` que está invertido e cria loop circular:

```typescript
const MARCA_ALIASES: Record<string, string> = {
  'VW': 'VOLKSWAGEN',
  'GM': 'CHEVROLET',
  'MERCEDES': 'MERCEDES-BENZ',
  'CHERY': 'CAOA CHERY',
  'CITROËN': 'CITROEN',
};
```

Na comparação (linha 233), adicionar fallback com valor original do banco:

```typescript
const marcaNormBanco = normalizarMarcaElegibilidade(r.marca);
const marcaMatch = marcaNormBanco === marcaNormAPI
  || r.marca.trim().toUpperCase() === veiculo.marca.trim().toUpperCase();
```

### Edição 2 — Matching de modelo (linhas 236-241)

Adicionar normalização que remove parênteses, wildcard e fallback por primeira palavra:

```typescript
// Normalizar modelo: remover qualificadores entre parênteses
const modeloBanco = r.modelo.trim().toUpperCase()
  .replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const modeloAPIClean = modeloAPI
  .replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

// Wildcard: TODOS OS MODELOS aceita qualquer modelo
if (modeloBanco.startsWith('TODOS')) {
  // pula direto para check de ano/combustivel
} else {
  const prefixMatch = modeloAPIClean.startsWith(modeloBanco)
    || modeloBanco.startsWith(modeloAPIClean);
  const containsMatch = modeloAPIClean.includes(modeloBanco)
    || modeloBanco.includes(modeloAPIClean);
  const baseBanco = modeloBanco.split(' ')[0];
  const baseMatch = baseBanco.length >= 2 && (
    modeloAPIClean.startsWith(baseBanco + ' ') || modeloAPIClean === baseBanco
  );
  const modeloMatch = prefixMatch || containsMatch || baseMatch;
  if (!modeloMatch) return false;
}
```

### Edição 3 — Remover hard gate (linhas 371-380)

Remover o `continue` da linha 379. O plano permanece nos resultados com `elegibilidadeStatus: 'negado'`, e o badge visual existente no `PlanoCardCotacao` passa a aparecer:

```typescript
if (elegibilidadeStatus === 'negado') {
  negados.push({
    planoId: plano.id,
    planoNome: plano.nome,
    linha,
    motivo: 'Modelo não elegível para este plano',
  });
  // NÃO faz continue — plano permanece com badge visual
}
```

### Arquivo editado
- `src/hooks/usePlanosCotacao.ts` — único arquivo modificado

### Resultado
- KA (NOVO) → normaliza para KA → match com "KA SE 1.0"
- TODOS OS MODELOS → wildcard → aceita qualquer modelo
- VW ↔ VOLKSWAGEN → alias correto sem loop
- Planos negados aparecem na UI com badge de restrição

