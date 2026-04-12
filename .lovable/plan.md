

## Plano: Unificar "Categoria Especial" em "Tipo de Placa"

### Contexto
"Categoria Especial" e "Tipo de Placa" representam o mesmo conceito (leilão, táxi, chassi remarcado, etc.). O sistema tem ambos como rule types separados, causando confusão. Vamos remover `categoria_especial` e manter apenas `tipo_placa`.

### Alterações

**1. `src/hooks/useEntityEligibilityRules.ts`**
- Remover `categoria_especial` do type `RuleType`
- No `checkRuleAgainstVehicle`, remover o case `categoria_especial` (linhas 237-242)
- No case `tipo_placa`, adicionar fallback para ler `cfg.categorias` (compatibilidade com regras legadas salvas como `categoria_especial`)

**2. `src/components/admin/planos/EligibilityRulesEditor.tsx`**
- Remover `categoria_especial` de `RULE_TYPE_LABELS` e `RULE_TYPE_ICONS`
- Remover o bloco de UI `{ruleType === 'categoria_especial' && ...}` (linhas 386-401)
- No `RuleCard`, remover `categoria_especial` do case de descrição (linha 178)

**3. `src/components/gestao-comercial/LinhasPlanos.tsx`**
- Remover `categoria_especial` de `RULE_BADGE_STYLES` (linha 83) e `RULE_LABELS` (linha 93)

**4. `src/components/gestao-comercial/CadastrosBase.tsx`**
- Remover a tab "Categorias Especiais" (já coberta por "Tipos de Placa")

**5. `src/components/gestao-comercial/cadastros/CategoriasEspeciaisTab.tsx`**
- Pode ser removido (arquivo inteiro) já que "Tipos de Placa" cobre a mesma funcionalidade

**6. `supabase/functions/_shared/eligibility-filter.ts`**
- Sem alteração necessária (já não tem case `categoria_especial`)

**7. Migração SQL**
- Converter regras existentes: `UPDATE entity_eligibility_rules SET rule_type = 'tipo_placa', rule_config = jsonb_set(rule_config, '{values}', COALESCE(rule_config->'categorias', rule_config->'values', '[]')) WHERE rule_type = 'categoria_especial' AND is_active = true`
- Desativar regras duplicadas que conflitem com `tipo_placa` já existente para a mesma entidade

**8. `src/hooks/usePlanosCotacao.ts`** (linha 235)
- Campo `categoriaEspecial` no VehicleContext já é mapeado de `p.categoria`, mesmo valor usado em `tipoPlaca` (linha 242). Remover `categoriaEspecial` do contexto.

### Resultado
- Dropdown de "Tipo de Regra" não mostrará mais "Categoria Especial"
- Regras existentes serão migradas para `tipo_placa`
- Tab de cadastro "Categorias Especiais" removida (valores já geridos em "Tipos de Placa")

