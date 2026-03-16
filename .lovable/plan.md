

## Plano: Incluir motos nos filtros de veículos via API FIPE

### Problema
`CotacaoFormDialog.tsx` hardcoda `'carros'` nas chamadas `getMarcas` e `getModelos`. O `Cotador.tsx` usa listas hardcoded que só contêm carros. A API FIPE já suporta motos nativamente.

### Edições

**1. `src/components/cotacoes/CotacaoFormDialog.tsx`**

- **Linha 441**: Carregar marcas de carros E motos:
```typescript
const [carros, motos] = await Promise.all([
  getMarcas('carros'),
  getMarcas('motos'),
]);
setMarcas([...carros, ...motos]);
```

- **Linha 487**: Usar tipo detectado para modelos:
```typescript
const tipoFipe = tipoVeiculoDetectado === 'moto' ? 'motos' : 'carros';
const data = await getModelos(value, tipoFipe);
```

**2. `src/pages/vendas/Cotador.tsx`**

Adicionar marcas e modelos de motos às constantes `MARCAS` e `MODELOS_POR_MARCA`:
- Marcas: Honda Motos, Yamaha, Suzuki, Kawasaki, BMW Motorrad, Dafra, Shineray, Haojue
- Modelos populares de cada marca (CG 160, Fazer 250, Bros 160, etc.)

### Resultado
- Ambos os fluxos de cotação passam a listar motos
- A detecção de tipo de veículo (`detectarTipoVeiculo`) já existente continua funcionando para elegibilidade e precificação

