

# Faixas de Preço por Intervalo FIPE nas Coberturas e Benefícios

## Resumo

Quando "Varia com FIPE?" é ativado, além de Mínimo e Máximo, aparece um campo **Intervalo FIPE (R$)**. O sistema calcula automaticamente quantas faixas existem (`(max - min) / intervalo`) e exibe campos de valor manual para cada faixa. Esses valores por faixa são persistidos no `rule_config` da regra `fipe_range`.

## Exemplo

- Mínimo: R$ 30.000 | Máximo: R$ 60.000 | Intervalo: R$ 5.000
- Cálculo: (60000 - 30000) / 5000 = **6 faixas**
- Faixas geradas: 30k-35k, 35k-40k, 40k-45k, 45k-50k, 50k-55k, 55k-60k
- Cada faixa tem um campo de valor (R$) preenchido manualmente

## Alterações

### 1. `EligibilityConfigSection.tsx` — Estado e UI

**Estado** — adicionar ao `EligibilityState`:
- `fipeIntervalo: string` (valor do intervalo)
- `fipeValoresFaixa: Record<number, string>` (mapa índice → valor R$)

**Carregar** — no `useEligibilityState`, ler `cfg.intervalo` e `cfg.faixas` do `rule_config` existente.

**UI** — quando `variaComFipe` está ativo:
- Após Min/Max, exibir campo "Intervalo FIPE (R$)"
- Calcular `numFaixas = Math.floor((max - min) / intervalo)` em tempo real
- Se numFaixas > 0 e ≤ 50, renderizar grid de campos:
  ```
  R$ 30.000 – R$ 35.000:  [_____ valor]
  R$ 35.000 – R$ 40.000:  [_____ valor]
  ...
  ```
- Cada campo atualiza `fipeValoresFaixa[index]`

### 2. `EligibilityConfigSection.tsx` — Persistência (`saveEligibilityRules`)

No `rule_config` da regra `fipe_range`, salvar:
```json
{
  "min": 30000,
  "max": 60000,
  "intervalo": 5000,
  "faixas": [
    { "de": 30000, "ate": 35000, "valor": 89.90 },
    { "de": 35000, "ate": 40000, "valor": 99.90 },
    ...
  ]
}
```

### 3. Nenhuma migração de banco

O campo `rule_config` já é JSONB — comporta a nova estrutura sem alteração de schema.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/gestao-comercial/EligibilityConfigSection.tsx` | Adicionar campo intervalo, cálculo de faixas, campos de valor por faixa, persistência no rule_config |

## Comportamento

- Se intervalo não preenchido ou = 0, não mostra faixas
- Se resultado > 50 faixas, exibe aviso "Intervalo muito pequeno"
- Ao alterar min/max/intervalo, faixas são recalculadas preservando valores já preenchidos quando possível
- Formatação dos labels das faixas usa `formatarMoeda` de `@/utils/format`

