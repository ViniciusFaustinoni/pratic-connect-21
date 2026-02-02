
# Plano: Centralizar Gestão de Planos e Benefícios na Diretoria

## Objetivo

Unificar a criação, edição e exclusão de planos, benefícios, coberturas e linhas de produtos **exclusivamente na área da Diretoria**, mantendo a área de Vendas apenas para **visualização/consulta**.

## Situação Atual

Existem **duas estruturas paralelas** que precisam ser correlacionadas:

| Aspecto | Diretoria (Operacional) | Vendas (Comercial) |
|---------|------------------------|-------------------|
| Tabela principal | `planos` (18 registros) | `plans` (14 registros) |
| Tabelas relacionadas | `tabelas_preco`, `planos_coberturas` | `product_lines`, `benefits`, `plan_benefits` |
| Rota atual | `/diretoria/produtos` | `/vendas/planos-beneficios` |
| Funcionalidade | Criar/editar preços e coberturas | Exibir + editar (se diretor) |

O sistema comercial (`plans`, `benefits`, etc.) já possui **dados criados** que devem ser preservados. A área de Vendas já permite edição para diretores, mas isso será movido para uma área dedicada na Diretoria.

## Estratégia

1. **Criar nova rota na Diretoria** para gestão comercial de planos
2. **Adicionar item no menu** da Diretoria
3. **Remover funções de edição** da área de Vendas
4. **Manter dados existentes** nas tabelas `plans`, `benefits`, etc.

## Arquivos a Modificar

### 1. `src/components/layout/AppSidebar.tsx`

**Alteração:** Adicionar item "Planos e Benefícios" no menu Diretoria

```typescript
// Linha ~343: Após "Produtos"
{ title: 'Planos/Benefícios', url: '/diretoria/planos-beneficios', icon: Gift },
```

### 2. `src/App.tsx`

**Alteração:** Adicionar rota para página de gestão na Diretoria

```typescript
// Após linha 494 (/diretoria/produtos)
<Route path="/diretoria/planos-beneficios" element={<PlanosAdmin />} />
```

Isso reutiliza a página `PlanosAdmin` que já existe e contém:
- Tab Planos (gestão de `plans`)
- Tab Benefícios (gestão de `benefits`)
- Tab Coberturas (gestão de `main_coverages`)
- Tab Linhas de Produtos (gestão de `product_lines`)

### 3. `src/pages/vendas/PlanosBeneficios.tsx`

**Alterações principais:**

a) **Remover variável de permissão para edição:**
```typescript
// Remover ou mudar para sempre false
const podeEditar = false; // Antes: isDiretor || isDesenvolvedor
```

b) **Remover estados de edição** (linhas 88-97):
- `editModalOpen`, `planToEdit`
- `beneficioModalOpen`, `beneficioToEdit`
- `deleteDialogOpen`, `planToDelete`, etc.

c) **Remover botões de ação no header** (linha 217-221):
- Remover botão "Novo Plano"

d) **Remover handlers de edição/exclusão** (linhas 118-181):
- `handleEditPlan`, `handleCreatePlan`, `handleDeletePlan`
- `handleEditBeneficio`, `handleCreateBeneficio`, `handleDeleteBeneficio`
- `confirmDelete`, `confirmDeleteBeneficio`

e) **Atualizar componentes filhos** para não passar props de edição:
```typescript
// PlanoLineSection - remover props canEdit, onEditPlan, onDeletePlan
<PlanoLineSection
  key={line.id}
  productLine={line}
  plans={getPlansByLineId(line.id)}
/>
```

f) **Remover modais de edição** (linhas 478-520):
- `PlanFormModal`
- `BeneficioAdicionalModal`
- `AlertDialog` de exclusão

g) **Adicionar banner informativo** para diretores:
```typescript
{isDiretor && (
  <Alert className="border-blue-200 bg-blue-50">
    <Settings className="h-4 w-4 text-blue-600" />
    <AlertDescription>
      Para criar ou editar planos, acesse{' '}
      <Link to="/diretoria/planos-beneficios" className="font-medium underline">
        Diretoria → Planos/Benefícios
      </Link>
    </AlertDescription>
  </Alert>
)}
```

### 4. `src/components/planos/PlanoLineSection.tsx`

**Alteração:** Remover props de edição e botões de ação

```typescript
// Interface simplificada
interface PlanoLineSectionProps {
  productLine: ProductLine;
  plans: PlanWithDetails[];
  // Remover: canEdit, onEditPlan, onDeletePlan
}
```

## Fluxo Resultante

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           DIRETORIA                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Produtos]                    [Planos/Benefícios]                  │
│  /diretoria/produtos           /diretoria/planos-beneficios          │
│  ├── Tabela planos             ├── Tab Planos (plans)               │
│  ├── Tabela de Preços          ├── Tab Benefícios (benefits)        │
│  └── Coberturas operacionais   ├── Tab Coberturas (main_coverages)  │
│                                └── Tab Linhas (product_lines)       │
│                                                                      │
│  [Criar] [Editar] [Excluir]    [Criar] [Editar] [Excluir]          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Dados fluem para
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            VENDAS                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Planos e Benefícios]         (Somente visualização)               │
│  /vendas/planos-beneficios                                          │
│  ├── Visão Geral                                                    │
│  ├── Carros                                                         │
│  ├── Motos                                                          │
│  ├── Adicionais (consulta)                                          │
│  ├── Ranking                                                        │
│  └── Glossário                                                      │
│                                                                      │
│  [Consultar] [Calcular] [Comparar]  ← Funcionalidades mantidas      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Dados Preservados

| Tabela | Registros | Ação |
|--------|-----------|------|
| `plans` | 14 | Mantidos, gerenciados via `/diretoria/planos-beneficios` |
| `product_lines` | 4 | Mantidos |
| `benefits` | 16 | Mantidos |
| `plan_benefits` | 147 | Mantidos (vínculos plano-benefício) |
| `beneficios_adicionais` | 14 | Mantidos |
| `planos` | 18 | Mantidos, gerenciados via `/diretoria/produtos` |

## Resumo de Arquivos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/layout/AppSidebar.tsx` | Modificar | Adicionar item "Planos/Benefícios" no menu Diretoria |
| `src/App.tsx` | Modificar | Adicionar rota `/diretoria/planos-beneficios` |
| `src/pages/vendas/PlanosBeneficios.tsx` | Modificar | Remover toda lógica de edição, manter apenas visualização |
| `src/components/planos/PlanoLineSection.tsx` | Modificar | Remover props de edição |

## Observações Técnicas

- A página `PlanosAdmin` (já existente) será reutilizada na nova rota da Diretoria
- O acesso é controlado por permissões (`isDiretor`, `isDesenvolvedor`, `isAdminMaster`)
- As tabelas comerciais (`plans`, `benefits`) permanecem separadas das operacionais (`planos`)
- Se futuramente quiser unificar as tabelas, será necessário uma migração de dados
