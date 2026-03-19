

# Correção: Calculadora de Preço deve aplicar os mesmos filtros do motor de cotação

## Problema

A Calculadora (`CalculadoraPreco.tsx`) não aplica dois filtros críticos que o Cotador (`usePlanosCotacao.ts`) aplica:

1. **Hard Gate de elegibilidade** — No cotador (linhas 481-484), quando um plano tem regras de elegibilidade (whitelist) configuradas mas não há dados de marca/modelo disponíveis, o plano é **negado**. Na calculadora (linhas 502-516), a elegibilidade só é verificada quando há dados de placa (`veiculoPlaca`). Sem placa, planos com whitelist (como "Especial") aparecem livremente.

2. **Filtro de categorias aceitas do plano** — No cotador (linhas 444-454), o campo `plano.categoria` é verificado contra a categoria do veículo selecionada. Se o plano define categorias aceitas e a categoria do veículo não está entre elas, o plano é excluído. A calculadora não faz essa verificação.

## Alterações

### `src/components/planos/CalculadoraPreco.tsx`

**1. Hard Gate de elegibilidade (após linha ~516):**
Quando existem regras de elegibilidade para a linha do plano mas não há dados de marca/modelo (sem consulta de placa), aplicar a mesma política do cotador: **negar o plano**. Só permitir passagem quando não há regras configuradas.

```
// Atual (só verifica com placa):
if (veiculoPlaca?.marca && veiculoPlaca?.modelo && anoNum) {
  if (temRegras) { ... if negado → continue }
}

// Corrigido (hard gate sem placa):
if (temRegras) {
  if (veiculoPlaca?.marca && veiculoPlaca?.modelo && anoNum) {
    // verificar elegibilidade normalmente
  } else {
    continue; // hard gate: sem dados → negar
  }
}
```

**2. Filtro de categorias aceitas do plano (após blocked categories, ~linha 520):**
Adicionar a mesma verificação do cotador para `plano.categoria`:

```typescript
const categoriasAceitasPlano = (plano.categoria || '')
  .split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
if (categoriasAceitasPlano.length > 0 && categoriaAtiva) {
  if (!categoriasAceitasPlano.includes(categoriaAtiva) 
      && !categoriasAceitasPlano.includes('todos')) {
    continue;
  }
}
```

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/planos/CalculadoraPreco.tsx` | Hard gate + filtro categorias aceitas |

