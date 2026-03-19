

# Auto-recalcular ao mudar inputs na Calculadora

## Problema

Hoje o usuário precisa clicar "Calcular" toda vez que muda qualquer campo (tipo de uso, categoria, combustível, etc.). O comportamento esperado é: após o primeiro cálculo, qualquer mudança nos inputs deve recalcular automaticamente.

## Solução

### `src/components/planos/CalculadoraPreco.tsx`

1. **Adicionar um estado `jaCalculou`** (`boolean`, default `false`) — setado `true` quando o usuário clica "Calcular" pela primeira vez.

2. **Adicionar um `useEffect`** que observa todas as dependências relevantes (`tipoUso`, `tipoVeiculo`, `categoria`, `combustivelManual`, `anoVeiculo`, `valorFipe`, `veiculoPlaca`, `regiao`) e, **se `jaCalculou` for `true`**, chama `calcular()` automaticamente.

3. **Na função `limpar`**, resetar `jaCalculou` para `false`.

4. O botão "Calcular" continua existindo para o primeiro disparo (e para recalcular manualmente se desejado).

### Detalhes técnicos

```typescript
const [jaCalculou, setJaCalculou] = useState(false);

// No onClick do botão Calcular:
const handleCalcular = () => {
  calcular();
  setJaCalculou(true);
};

// Auto-recalcular quando inputs mudam após primeiro cálculo
useEffect(() => {
  if (jaCalculou) {
    calcular();
  }
}, [tipoUso, tipoVeiculo, categoria, combustivelManual, anoVeiculo, valorFipe, veiculoPlaca, regiao]);

// No limpar:
setJaCalculou(false);
```

| Arquivo | Mudança |
|---------|---------|
| `CalculadoraPreco.tsx` | +1 estado, +1 useEffect, ajuste no botão e no limpar |

