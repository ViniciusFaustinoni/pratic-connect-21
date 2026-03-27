

# Separar Elegibilidade FIPE da Variação por FIPE

## Problema

Atualmente, o toggle "Varia com FIPE?" controla simultaneamente duas coisas distintas:
1. **Elegibilidade FIPE** — define a partir de qual valor FIPE e até qual valor o item aparece na cotação (filtro de visibilidade)
2. **Variação por FIPE** — define preços segmentados por faixa FIPE com intervalo

Precisam ser campos independentes. Um benefício pode ter elegibilidade FIPE (só aparece para carros de 30k-80k) sem ter variação de preço por faixa, e vice-versa.

## Solução

### 1. `EligibilityConfigSection.tsx` — Separar em dois blocos

**Novo bloco: Elegibilidade por FIPE** (sempre visível, sem toggle)
- Dois campos numéricos: `elegFipeMin` e `elegFipeMax`
- Label: "Elegibilidade por FIPE" com descrição "Define para quais valores de FIPE este item aparece na cotação"
- Se ambos vazios → aparece para todos

**Bloco existente: Variação por FIPE** (com toggle, como já está)
- Mantém "Varia com FIPE?" com min, max, intervalo e faixas de preço
- Este controla a precificação segmentada

### 2. `EligibilityState` — Novos campos

Adicionar `elegFipeMin` e `elegFipeMax` ao state, separados dos campos `fipeMin`/`fipeMax` da variação.

### 3. `saveEligibilityRules()` — Nova regra `fipe_eligibility`

- Salvar como `rule_type: 'fipe_eligibility'` (novo tipo) com `{ min, max }`
- Manter `fipe_range` para a variação de preço como está

### 4. `useEntityEligibilityRules.ts` — Motor de cotação

- Adicionar `'fipe_eligibility'` ao type `RuleType`
- Adicionar case em `checkRuleAgainstVehicle` para verificar se o veículo está dentro do range de elegibilidade
- O `fipe_range` continua sendo usado para precificação (não para filtragem de visibilidade)

### 5. Hydration do state existente

No `useEligibilityState`, carregar `fipe_eligibility` rules nos novos campos `elegFipeMin`/`elegFipeMax`.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/gestao-comercial/EligibilityConfigSection.tsx` | Adicionar campos elegFipeMin/Max, novo bloco UI, salvar como `fipe_eligibility` |
| `src/hooks/useEntityEligibilityRules.ts` | Adicionar tipo `fipe_eligibility` e case no motor |

