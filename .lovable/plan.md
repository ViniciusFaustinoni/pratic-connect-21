

## Plano: Tornar coberturas somente leitura no modal de plano

### Problema
Ao expandir uma cobertura no modal de edição de plano, aparece um formulário editável com botão "Salvar Cobertura". As coberturas devem ser somente leitura neste contexto.

### Alteração

**`src/components/admin/planos/PlanCoberturasList.tsx`**

1. Substituir o componente `CoberturaInlineForm` por um componente `CoberturaReadOnlyView` que exibe todos os dados sem inputs editáveis:
   - Nome, Código, Subtítulo, Descrição como texto estático
   - Valores financeiros (já são read-only)
   - Ordem e status Ativo como texto
   - Carência como texto
   - Remover botão "Salvar Cobertura"
   - Remover imports não utilizados (Input, Textarea, Switch, Save, useUpdateCobertura, CarenciaConfigSection, EligibilityRulesEditor)

2. Manter funcionalidades de **excluir** (desvincular) e **criar nova cobertura** — essas são operações no nível do plano, não edição da cobertura em si.

### Resultado
- Expandir cobertura mostra dados em formato somente leitura
- Não é possível editar campos da cobertura a partir do plano
- Criação e exclusão de vínculos continuam funcionando

### Arquivo
- `src/components/admin/planos/PlanCoberturasList.tsx`

