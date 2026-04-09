
## Plano: Adicionar campos de valores editaveis nas coberturas e beneficios

### Problema
Os formularios inline de cobertura (`CoberturaInlineForm`) e beneficio (`BeneficioInlineForm`) no modal de edicao de plano nao mostram nem permitem editar os campos de valor financeiro.

### Alteracoes

**1. `CoberturaInlineForm`** em `src/components/admin/planos/PlanCoberturasList.tsx`
- Adicionar ao state do form: `valor`, `valor_limite`, `percentual_cobertura`, `franquia_percentual`, `franquia_valor`
- Adicionar secao de campos no formulario com grid 3 colunas:
  - Valor (R$) — `valor`
  - Valor Limite (R$) — `valor_limite`
  - % Cobertura — `percentual_cobertura`
- Adicionar linha com grid 2 colunas:
  - Franquia (%) — `franquia_percentual`
  - Franquia (R$) — `franquia_valor`
- Incluir esses campos no payload do `handleSave`

**2. `BeneficioInlineForm`** em `src/components/admin/planos/PlanBeneficiosList.tsx`
- Adicionar ao state do form: `preco_sugerido`
- Adicionar campo "Preco Sugerido (R$)" no grid existente de Ordem/Ativo
- Incluir no payload do `handleSave`

### Resultado
- Valores financeiros visiveis e editaveis diretamente no formulario inline
- Salvos via os hooks existentes `useUpdateCobertura` / `useUpdateBenefit` (que ja aceitam esses campos)

### Arquivos
- `src/components/admin/planos/PlanCoberturasList.tsx`
- `src/components/admin/planos/PlanBeneficiosList.tsx`
