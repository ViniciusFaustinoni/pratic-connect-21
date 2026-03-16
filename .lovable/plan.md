

## Plano: Corrigir detecção de tipo de veículo na seleção manual

### Problema raiz

Dois bugs fazem os planos de carro aparecerem quando o vendedor seleciona uma moto manualmente:

1. **`tipoVeiculoDetectado`** (linha 316) usa `detectarTipoVeiculo()` baseado no nome da marca, mas ignora completamente o `tipoFipeSelecionado` que já rastreia corretamente se é `'carros'` ou `'motos'`. "HONDA" existe nas duas categorias, então a detecção por nome falha.

2. **`modeloResolvido`** (linha 329) só lê de `veiculoEncontrado?.vehicleData?.modelo`, que é `null` na seleção manual. O modelo selecionado manualmente nunca chega ao hook `usePlanosCotacao`, prejudicando filtragem e elegibilidade.

### Edições

**`src/components/cotacoes/CotacaoFormDialog.tsx`**

1. **`tipoVeiculoDetectado`** — Priorizar `tipoFipeSelecionado` quando há seleção manual ativa:
```typescript
const tipoVeiculoDetectado = useMemo(() => {
  // Se o vendedor selecionou marca manualmente, usar o tipo da marca
  if (marcaSelecionada && tipoFipeSelecionado === 'motos') return 'moto' as const;
  // Fallback para detecção por nome (busca por placa/código)
  const marca = veiculoEncontrado?.vehicleData?.marca || getMarcaNomeFromCodigo(marcaSelecionada) || '';
  const modelo = veiculoEncontrado?.vehicleData?.modelo || '';
  if (!marca && !modelo) return 'carro' as const;
  const tipo = detectarTipoVeiculo(undefined, modelo, marca);
  return tipo === 'moto' ? 'moto' as const : 'carro' as const;
}, [veiculoEncontrado, marcaSelecionada, getMarcaNomeFromCodigo, tipoFipeSelecionado]);
```

2. **`modeloResolvido`** — Incluir nome do modelo da seleção manual:
```typescript
const modeloResolvido = useMemo(() => {
  if (veiculoEncontrado?.vehicleData?.modelo) return veiculoEncontrado.vehicleData.modelo;
  const mod = modelos.find(m => m.codigo.toString() === modeloSelecionado);
  return mod?.nome || '';
}, [veiculoEncontrado, modeloSelecionado, modelos]);
```

### Resultado
- Selecionar "HONDA (Moto)" → `tipoVeiculo = 'moto'` → planos Advanced aparecem
- Selecionar "HONDA (Carro)" → `tipoVeiculo = 'carro'` → planos Select/Especial aparecem
- Modelo manual é passado ao motor de elegibilidade para filtragem correta

