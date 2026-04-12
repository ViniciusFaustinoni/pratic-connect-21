

## Plano: Permitir edição de regras de elegibilidade existentes

### Problema
Atualmente, ao clicar em uma regra de elegibilidade em um benefício ou plano, só é possível excluí-la. Não há opção de editar os valores já configurados (regiões, tipos de uso, combustíveis, etc.).

### Solução
Tornar cada `RuleCard` clicável para abrir o mesmo dialog de configuração (`AddRuleDialog`), pré-preenchido com os valores atuais da regra.

### Alterações em `src/components/admin/planos/EligibilityRulesEditor.tsx`

**1. Adicionar estado de edição no componente principal**
- Novo state `editingRule: EligibilityRule | null`
- Ao clicar no RuleCard (não no botão de delete), setar `editingRule` com a regra clicada
- Passar `editingRule` para o dialog

**2. Tornar RuleCard clicável**
- Adicionar `onClick` no container do card (cursor-pointer)
- Prop `onEdit: (rule) => void` no RuleCard

**3. Refatorar `AddRuleDialog` para suportar edição**
- Renomear para `RuleDialog` (ou manter nome, adicionar prop `editingRule?: EligibilityRule`)
- Se `editingRule` presente: pré-popular `ruleType`, `ruleMode` e `config` com os valores da regra
- Desabilitar o select de tipo de regra quando editando (não faz sentido trocar o tipo)
- No `handleSave`, passar o `id` da regra existente para que `useSaveRule` faça update em vez de insert
- Título do dialog: "Editar Regra" vs "Adicionar Regra"

**4. Ajustar `useSaveRule` em `src/hooks/useEntityEligibilityRules.ts`**
- Verificar se já suporta update (pelo memory, já faz upsert por entity_id + rule_type)
- Se não suportar edição direta por ID, adicionar lógica para update quando `id` é passado

### Resultado
- Clicar em qualquer regra existente abre o dialog com valores preenchidos para edição
- Salvar atualiza a regra no banco sem criar duplicata
- Funciona em planos, benefícios e coberturas (todos usam o mesmo componente)

