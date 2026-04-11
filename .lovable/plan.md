

## Plano: Consolidar ações do plano em dropdown e adicionar modal de elegibilidade

### Problema
Os botões de editar, duplicar e excluir ocupam espaço individualmente na linha do plano. Falta opção rápida para configurar elegibilidade sem abrir o PlanFormModal completo.

### Alterações

**Editar**: `src/components/gestao-comercial/LinhasPlanos.tsx`

1. **Substituir os 3 botões de ação (linhas 607-627)** por um único botão `MoreVertical` (ou `MoreHorizontal`) que abre um `DropdownMenu` com 4 opções:
   - Editar (abre PlanFormModal)
   - Configurar Elegibilidade (abre novo modal dedicado)
   - Duplicar (abre DuplicarPlanoModal)
   - Excluir (abre confirmação) — visível apenas se `canDelete`

2. **Adicionar estado** `eligibilityModal: { open: boolean; planId?: string; planName?: string }`

3. **Adicionar Dialog** com `EligibilityRulesEditor entityType="plano" entityId={planId}` — reutilizando o componente já existente

4. **Imports adicionais**: `DropdownMenu*` do shadcn, `MoreVertical` do lucide, `EligibilityRulesEditor`

### Resultado
- Interface mais limpa com um único ícone de menu por plano
- Acesso direto à configuração de elegibilidade sem passar pelo formulário completo do plano

