

# Correcao BUG-2: Alerta de dispensa mostra threshold errado para motos

## Problema

Na linha 1257 de `InstaladorChecklist.tsx`, o alerta de dispensa de rastreador sempre exibe `fipeMinRastreador` (R$ 30.000), mesmo para motos que deveriam mostrar `fipeMinRastreadorMoto` (R$ 9.000).

## Correcao

Uma unica alteracao na linha 1257:

**De:**
```
Veículo com FIPE abaixo de R$ {fipeMinRastreador.toLocaleString(...)}
```

**Para:**
```
Veículo com FIPE abaixo de R$ {(tipoVeiculo === 'moto' ? fipeMinRastreadorMoto : fipeMinRastreador).toLocaleString(...)}
```

Ambas as variaveis (`tipoVeiculo` e `fipeMinRastreadorMoto`) ja estao disponiveis no escopo do componente.

## Arquivo alterado

| Arquivo | Linha | Alteracao |
|---|---|---|
| `src/pages/instalador/InstaladorChecklist.tsx` | 1257 | Expressao condicional para exibir threshold correto |

## Nenhum outro arquivo alterado

