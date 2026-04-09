

## Plano: Tornar coberturas editaveis inline no modal do plano

### Problema
Coberturas no modal de plano usam `CoberturaReadOnlyView` (somente leitura). Beneficios ja tem formulario editavel completo (`BeneficioInlineForm`) com carencia, regras de elegibilidade e botao salvar. O pedido e que coberturas tenham o mesmo nivel de edicao.

### Alteracoes

**1. `src/hooks/usePlansAdmin.ts` — Expandir `CoberturaInput`**
- Adicionar campos financeiros que existem na tabela `coberturas` mas faltam no tipo:
  - `valor`, `valor_limite`, `percentual_cobertura`, `franquia_percentual`, `franquia_valor`
  - `carencia_ativa`, `carencia_dias`, `carencia_tipo`, `carencia_multiplicador`

**2. `src/components/admin/planos/PlanCoberturasList.tsx` — Substituir read-only por formulario editavel**
- Remover `CoberturaReadOnlyView`
- Criar `CoberturaInlineForm` seguindo o mesmo padrao de `BeneficioInlineForm`:
  - Campos editaveis: icone, nome, codigo, subtitulo, descricao
  - Campos financeiros: valor (R$), valor limite (R$), % cobertura, franquia (%), franquia (R$)
  - Ordem, status ativo/inativo
  - `CarenciaConfigSection` (carencia ativa, tipo, dias, multiplicador)
  - `EligibilityRulesEditor` (regras de elegibilidade da cobertura)
  - Botao "Salvar Cobertura" usando `useUpdateCobertura`

### Resultado
- Todas as configuracoes de coberturas (valores, franquias, carencias, regras) editaveis diretamente no modal do plano
- Consistencia total entre a experiencia de edicao de coberturas e beneficios

### Arquivos
- `src/hooks/usePlansAdmin.ts`
- `src/components/admin/planos/PlanCoberturasList.tsx`

