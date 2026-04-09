

## Plano: Tornar valores financeiros somente leitura nos formularios inline

### Problema
Os campos de valores financeiros (Valor, Valor Limite, % Cobertura, Franquia %, Franquia R$, Preço Sugerido) foram adicionados como inputs editaveis nos formularios inline de coberturas e beneficios. O usuario quer que sejam apenas visuais (read-only).

### Alteracoes

**1. `CoberturaInlineForm`** em `src/components/admin/planos/PlanCoberturasList.tsx`
- Substituir os 5 `<Input>` financeiros (linhas 102-126) por exibicao somente leitura:
  - Usar `<div>` com texto formatado em R$ ou % em vez de inputs editaveis
  - Manter os labels, mas mostrar valores como texto estilizado (bg-muted, rounded, padding)
- Remover `valor`, `valor_limite`, `percentual_cobertura`, `franquia_percentual`, `franquia_valor` do state do form e do payload do `handleSave` (deixar esses campos inalterados no banco)

**2. `BeneficioInlineForm`** em `src/components/admin/planos/PlanBeneficiosList.tsx`
- Substituir o `<Input>` de `preco_sugerido` por exibicao somente leitura
- Remover `preco_sugerido` do state do form e do payload do `handleSave`

### Resultado
- Valores financeiros visiveis mas nao editaveis nos formularios inline
- Salvamento nao altera valores financeiros acidentalmente

### Arquivos
- `src/components/admin/planos/PlanCoberturasList.tsx`
- `src/components/admin/planos/PlanBeneficiosList.tsx`

