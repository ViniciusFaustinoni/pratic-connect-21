

## Plano: Regras de elegibilidade do plano sobrescrevem as mesmas regras nas coberturas/beneficios

### Problema
Atualmente, regras do plano e regras das coberturas/beneficios sao avaliadas de forma independente. Se o plano tem uma regra `tipo_uso` (ex: "aplicativo"), as coberturas individuais que tambem tem regra `tipo_uso` sao avaliadas separadamente, podendo causar conflitos ou redundancia.

### Solucao
No motor de cotacao, identificar quais `rule_type` existem no nivel do plano. Ao filtrar coberturas e beneficios, ignorar regras individuais cujo `rule_type` ja esta coberto por uma regra do plano.

### Alteracao

**`src/hooks/usePlanosCotacao.ts` (~linha 323-364)**

1. Apos obter `planoRulesNonMarcaModelo` (linha 323), extrair os tipos de regra ativos no plano:
```ts
const planoRuleTypes = new Set(
  planoRulesNonMarcaModelo.map(r => r.rule_type)
);
```

2. Na filtragem de beneficios (linha 339-341), excluir regras cujo tipo ja existe no plano:
```ts
const benefitRules = allEligibilityRules
  .filter(r => r.entity_type === 'beneficio' && r.entity_id === pb.benefit_id)
  .filter(r => r.rule_type !== 'fipe_range')
  .filter(r => !planoRuleTypes.has(r.rule_type)); // sobrescrita pelo plano
```

3. Na filtragem de coberturas (linha 354-356), mesma logica:
```ts
const cobRules = allEligibilityRules
  .filter(r => r.entity_type === 'cobertura' && r.entity_id === cobId)
  .filter(r => r.rule_type !== 'fipe_range')
  .filter(r => !planoRuleTypes.has(r.rule_type)); // sobrescrita pelo plano
```

### Resultado
- Se o plano "Select One Aplicativo" tem regra `tipo_uso: aplicativo`, as regras `tipo_uso` individuais das coberturas/beneficios desse plano sao ignoradas
- A regra do plano ja foi validada na etapa anterior (linha 327) e serve como filtro unico
- Outros tipos de regra nas coberturas (ex: `regiao`, `combustivel`) continuam funcionando normalmente se nao existem no nivel do plano

### Arquivo
- `src/hooks/usePlanosCotacao.ts`

