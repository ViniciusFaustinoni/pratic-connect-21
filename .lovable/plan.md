

# Calculadora de Preço — Motos, Elétricos e Busca por Placa

## Diagnóstico

A calculadora atual:
1. **Não filtra por tipo de veículo** — mostra apenas linhas de carro. Linhas como `advanced` (motos) e `eletrico` nunca aparecem porque a query não distingue `vehicle_type` do `product_lines`.
2. **Não tem campo de placa** — o usuário precisa saber o valor FIPE de cabeça. A edge function `plate-lookup` já existe e retorna marca, modelo, ano, tipo de veículo e valor FIPE pela placa.
3. **Não filtra combustível** — a tabela de preços tem `combustivel_tipo` mas a calculadora ignora, podendo mostrar faixas erradas.

## Plano

### 1. Adicionar seletor de Tipo de Veículo (Carro / Moto / Elétrico)

- Novo `ToggleGroup` com 3 opções: Carro, Moto, Elétrico
- Ao calcular, buscar os `vehicle_type` das `product_lines` e filtrar:
  - **Carro**: linhas com `vehicle_type = 'car'` ou `null` (exceto `eletrico` e `advanced`)
  - **Moto**: linhas com `vehicle_type = 'motorcycle'`
  - **Elétrico**: linha `eletrico` (precificação nacional, sem filtro de região)

### 2. Adicionar campo de Placa (opcional, acima do valor FIPE)

- Input de placa com máscara (ABC1D23 / ABC-1234)
- Botão "Consultar" que chama `plate-lookup` via `supabase.functions.invoke`
- Ao retornar, preenche automaticamente:
  - Valor FIPE (do campo `fipeData.valor`)
  - Tipo de veículo (detecta moto/carro/elétrico pelo `tipo_veiculo` e `combustivel`)
  - Exibe chip com marca/modelo/ano como contexto visual
- Campo FIPE continua editável (override manual)

### 3. Filtrar linhas pelo `product_lines.vehicle_type`

- Buscar `product_lines` (já existe hook `useProductLines`) para mapear `linha_slug → vehicle_type`
- No loop de cálculo, pular linhas cujo `vehicle_type` não corresponde ao tipo selecionado
- Para elétricos: ignorar região (precificação nacional)

### 4. Incluir combustível na busca

- Quando a placa retorna combustível, normalizar via `normalizarCombustivelParaPricing` e usar no filtro da faixa
- Para entrada manual, usar `null` (match qualquer)

## Arquivo Afetado

| Arquivo | Alteração |
|---------|-----------|
| `src/components/planos/CalculadoraPreco.tsx` | Adicionar placa, tipo veículo, filtro product_lines |

## Resultado Esperado

```text
┌─────────────────────────────────┐
│  Placa (opcional)   [_______] 🔍│
│  Valor FIPE         [R$ ____]  │
│  ✓ HB20 2021 Flex - Hyundai    │
│                                 │
│  Tipo: [Carro] [Moto] [Elétrico]│
│  Região: [Rio de Janeiro  ▾]   │
│  Uso:  [Particular] [Aplicativo]│
│                                 │
│  [  Calcular  ] [Limpar]       │
│─────────────────────────────────│
│  Select ........... R$ 189/mês  │
│  Lançamento ....... R$ 219/mês  │
│  Especial ......... R$ 249/mês  │
└─────────────────────────────────┘
```

