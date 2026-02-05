
## Plano: Ocultar Item "Ativações" para Vendedores no Menu Lateral

### Objetivo
Remover o item "Ativações" do menu lateral para usuários com o perfil "Vendedor" (`vendedor_clt` ou `vendedor_externo` exclusivamente).

---

### Análise Atual

**Arquivo:** `src/components/layout/AppSidebar.tsx`

- **Linhas 140-154:** Grupo "Vendas" com todos os itens, incluindo "Ativações" (linha 150)
- **Linhas 483-500:** Função `getVisibleGroups()` que filtra grupos e itens baseado em permissões
- **Linhas 486-497:** Exemplo de filtro específico para `isAnalistaCadastroOnly` que restringe itens para apenas "Cadastro"

O arquivo já importa `usePermissions()` (linha 83) e a função já detecta quando o usuário é um perfil limitado.

---

### Solução Proposta

Estender a função `getVisibleGroups()` para filtrar o item "Ativações" quando `permissions.isVendedorOnly` é true.

#### Mudança no `src/components/layout/AppSidebar.tsx`

**Linhas 483-500 (atualizar função `getVisibleGroups`):**

```typescript
// Se é apenas analista de cadastro, filtrar menu para mostrar apenas Cadastro
const getVisibleGroups = () => {
  const baseGroups = filterGroups(menuConfig.groups);
  
  if (permissions.isAnalistaCadastroOnly) {
    // Mostrar apenas grupo Cadastro com itens específicos
    return baseGroups
      .filter(g => g.id === 'cadastro')
      .map(group => ({
        ...group,
        items: group.items.filter(item => 
          item.url === '/cadastro/propostas' ||
          item.url === '/cadastro/associados'
        ),
      }));
  }
  
  // Se é apenas vendedor, remover item "Ativações" do grupo Vendas
  if (permissions.isVendedorOnly) {
    return baseGroups.map(group => {
      if (group.id === 'vendas') {
        return {
          ...group,
          items: group.items.filter(item => item.url !== '/vendas/ativacoes'),
        };
      }
      return group;
    });
  }
  
  return baseGroups;
};
```

---

### Comportamento Esperado

| Perfil | Visualiza "Ativações" |
|--------|----------------------|
| Vendedor CLT (apenas) | Não ❌ |
| Vendedor Externo (apenas) | Não ❌ |
| Diretor | Sim ✅ |
| Gerente Comercial | Sim ✅ |
| Supervisor de Vendas | Sim ✅ |
| Analista de Cadastro | Sim ✅ |
| Desenvolvedor | Sim ✅ |
| Admin Master | Sim ✅ |

---

### Fluxo do Vendedor

1. Vendedor faz login
2. Acessa o dashboard
3. No menu lateral, grupo "Vendas" fica visível com itens:
   - ✅ Leads
   - ✅ Cotação
   - ✅ Propostas
   - ✅ Consultores
   - ✅ Planos e Benefícios
   - ❌ **Ativações** (OCULTO)

---

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Estender função `getVisibleGroups()` para filtrar "Ativações" para `isVendedorOnly` |

---

### Estimativa

| Tarefa | Tempo |
|--------|-------|
| Atualizar `getVisibleGroups()` | 2 min |
| Testar com perfil vendedor | 3 min |
| **Total** | **~5 min** |

