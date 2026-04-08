
## Plan: fazer apenas o checkbox ser clicável em Coberturas e Benefícios

### Estado atual confirmado
Na tela Gestão Comercial > Linhas e Planos, o modal de edição usa:
- `src/components/gestao-comercial/LinhasPlanos.tsx` → abre `PlanFormModal`
- `src/components/admin/planos/PlanFormModal.tsx` → renderiza as listas de Coberturas e Benefícios

Hoje o problema continua porque, dentro de `SearchableSelectionSection`, cada item ainda está com o container inteiro interativo:

```tsx
<div
  role="button"
  tabIndex={0}
  onClick={() => onToggle(item.id)}
  onKeyDown={...}
>
```

Ou seja: a correção anterior removeu o erro de botão aninhado, mas manteve o comportamento errado de clicar no nome/linha inteira.

### O que vou ajustar
No arquivo `src/components/admin/planos/PlanFormModal.tsx`:

1. Remover a interatividade do container da linha
- tirar `role="button"`
- tirar `tabIndex={0}`
- tirar `onClick`
- tirar `onKeyDown`

2. Deixar somente o `Checkbox` responsável por marcar/desmarcar
- manter `checked={selected}`
- manter `onCheckedChange={() => onToggle(item.id)}`

3. Ajustar o visual para não parecer clicável
- remover `cursor-pointer` da linha
- remover feedback de hover que sugere clique na área do nome/texto
- manter apenas o destaque visual de item selecionado

### Resultado esperado
- Clicar no nome da cobertura ou do benefício não faz nada
- Clicar na descrição/meta também não faz nada
- Somente o checkbox marca/desmarca o item
- Nenhuma lógica de salvamento, busca, agrupamento ou banco será alterada

### Arquivo a alterar
- `src/components/admin/planos/PlanFormModal.tsx`

### Não será alterado
- queries Supabase
- persistência em `planos_coberturas` e `planos_beneficios`
- estrutura do modal
- filtros de busca
- ordem ou agrupamento dos itens
