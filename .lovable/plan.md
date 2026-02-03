
# Plano: Ajustes na Área de RH

## Objetivos
1. Alterar o botão "Novo Funcionário" no Dashboard de RH para abrir o modal de criação rápida (igual ao de Configurações)
2. Adicionar a opção "Jornadas" no submenu de Recursos Humanos

---

## Alterações Necessárias

### 1. Modificar `src/pages/rh/RHDashboard.tsx`

**Situação atual:**
- O botão "Novo Funcionário" faz `navigate('/rh/funcionarios/novo')` (navega para página de formulário)

**Alteração:**
- Importar o componente `NovoFuncionarioModal`
- Adicionar estado para controlar abertura do modal
- Trocar `navigate()` por `setShowModal(true)`
- Renderizar o modal no componente

```typescript
// Adicionar import
import { NovoFuncionarioModal } from '@/components/usuarios/NovoFuncionarioModal';

// Adicionar estado
const [showNovoFuncionarioModal, setShowNovoFuncionarioModal] = useState(false);

// Trocar onClick do botão
<Button onClick={() => setShowNovoFuncionarioModal(true)}>
  <Plus className="mr-2 h-4 w-4" />
  Novo Funcionário
</Button>

// Adicionar modal no final do componente
<NovoFuncionarioModal
  open={showNovoFuncionarioModal}
  onOpenChange={setShowNovoFuncionarioModal}
  onSuccess={() => {
    queryClient.invalidateQueries({ queryKey: ['rh-stats'] });
  }}
/>
```

**Locais a alterar no arquivo:**
- Linha 230: Botão principal no header
- Linha 547-551: Botão na seção de ações rápidas

---

### 2. Modificar `src/components/layout/AppSidebar.tsx`

**Situação atual:**
- Seção RH (linhas 291-305) não tem "Jornadas" no menu

**Alteração:**
- Adicionar item "Jornadas" na lista de itens do grupo RH

```typescript
{
  id: 'rh',
  label: 'Recursos Humanos',
  icon: UserCheck,
  permission: 'canManageRH',
  color: MENU_COLORS.rh,
  items: [
    { title: 'Dashboard', url: '/rh', icon: BarChart3 },
    { title: 'Funcionários', url: '/rh/funcionarios', icon: Users },
    { title: 'Jornadas', url: '/rh/jornadas', icon: Clock },  // ADICIONAR
    { title: 'Folha de Pagamento', url: '/rh/folha-pagamento', icon: DollarSign },
    { title: 'Ponto', url: '/rh/ponto', icon: Clock },
    { title: 'Férias', url: '/rh/ferias', icon: Palmtree },
    { title: 'Organograma', url: '/rh/organograma', icon: GitBranch },
    { title: 'Departamentos', url: '/rh/departamentos', icon: Building2 },
    { title: 'Benefícios', url: '/rh/beneficios', icon: Gift },
  ],
},
```

**Nota:** O ícone `Clock` já está importado no arquivo.

---

### 3. Atualizar `src/components/layout/GlobalBreadcrumb.tsx`

Adicionar mapeamento para a rota de jornadas:

```typescript
'/rh/jornadas': { label: 'Jornadas' },
```

---

## Resumo dos Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/rh/RHDashboard.tsx` | Importar modal, adicionar estado e renderizar |
| `src/components/layout/AppSidebar.tsx` | Adicionar item "Jornadas" no submenu RH |
| `src/components/layout/GlobalBreadcrumb.tsx` | Adicionar breadcrumb para `/rh/jornadas` |

---

## Fluxo Após Implementação

```
RH > Dashboard
    │
    ├─ Botão "Novo Funcionário"
    │   └─ Abre modal com: Nome, Email, CPF, Telefone, Perfil
    │       └─ Cria usuário via edge function 'create-user'
    │           └─ Envia email de convite automaticamente
    │
    └─ Submenu RH (Sidebar)
        ├─ Dashboard
        ├─ Funcionários
        ├─ Jornadas ← NOVO
        ├─ Folha de Pagamento
        ├─ Ponto
        ├─ Férias
        ├─ Organograma
        ├─ Departamentos
        └─ Benefícios
```

---

## Observação sobre Jornadas

A página de Jornadas (`JornadasProfissionais.tsx`) já está implementada e funcional:
- Exibe turnos de profissionais do dia
- Mostra estatísticas (trabalhando, em almoço, encerrados)
- Permite filtrar por data
- Usa a tabela `turnos_profissionais` já existente
- Cards com informações detalhadas via `JornadaProfissionalCard`
