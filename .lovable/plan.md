

# Plano: Visibilidade por Equipe para Supervisor de Vendas

## Situação Atual

- **Não existe** tabela de equipes comerciais nem campo `supervisor_id` nos profiles/vendedores
- A função RLS `is_gerencia()` inclui apenas `diretor` e `gerente_comercial` — **supervisor_vendas fica de fora**
- Na prática, o supervisor hoje vê leads **como um vendedor comum** (apenas os próprios)
- Cotações já têm RLS para `supervisor_vendas`, mas leads, contratos e outras tabelas não
- Nenhum mecanismo de vínculo supervisor→vendedores existe no banco

## Solução

### 1. Criar tabela `equipes_comerciais`

```text
equipes_comerciais
├── id (uuid PK)
├── supervisor_id (uuid → auth.users) — quem supervisiona
├── vendedor_id (uuid → auth.users) — quem é supervisionado
├── created_at (timestamptz)
└── UNIQUE(supervisor_id, vendedor_id)
```

RLS: Supervisores veem seus vínculos. Gerência/diretores veem todos. Gerência pode INSERT/UPDATE/DELETE.

### 2. Criar função RLS `is_supervisor_of()`

Função `SECURITY DEFINER` que verifica se o user autenticado é supervisor de um dado `vendedor_id`:

```sql
CREATE FUNCTION is_supervisor_of(_vendedor_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM equipes_comerciais
    WHERE supervisor_id = auth.uid()
      AND vendedor_id = _vendedor_id
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### 3. Atualizar RLS da tabela `leads`

A policy SELECT atual é:
```
is_gerencia(auth.uid()) OR vendedor_id = get_my_profile_id() OR vendedor_id IS NULL
```

Será alterada para:
```
is_gerencia(auth.uid()) 
OR vendedor_id = get_my_profile_id() 
OR vendedor_id IS NULL
OR is_supervisor_of(vendedor_id)
```

Mesma lógica para UPDATE e DELETE.

### 4. Atualizar RLS de `cotacoes` (UPDATE policy)

A policy de UPDATE de cotações não inclui supervisor — adicionar `is_supervisor_of(vendedor_id)`.

### 5. Criar hook `useEquipeComercial`

Hook para gerenciar os vínculos supervisor↔vendedor:
- `useMinhaEquipe()` — retorna vendedores da equipe do supervisor logado
- `useEquipesComerciais()` — para gerência, retorna todos os vínculos
- Mutations para adicionar/remover vendedores da equipe

### 6. Adaptar hooks de vendas para escopo de equipe

**`useLeads`**: Quando o usuário é `supervisor_vendas`, filtrar automaticamente por `vendedor_id IN equipe` (via RLS, sem mudança no hook — a RLS cuida).

**`useVendedorHistorico`**: Supervisor pode consultar stats de qualquer vendedor da sua equipe.

**`useVendasMetricas`**: Supervisor vê métricas agregadas apenas da sua equipe (filtro client-side usando `useMinhaEquipe`).

### 7. UI: Tela de gerenciamento de equipe

Adicionar em `/vendas/equipe-comercial` (rota já existe, aponta para `Propostas`) uma seção ou tab para o supervisor gerenciar sua equipe:
- Lista de vendedores vinculados
- Botão para adicionar/remover (apenas gerência/diretor pode fazer isso)
- Métricas agregadas por vendedor da equipe

### 8. UI: Kanban com identificação do vendedor

No componente `LeadKanbanCard`, quando o usuário é supervisor, mostrar badge com nome do vendedor responsável pelo lead.

## Arquivos afetados

- **Migration SQL**: tabela `equipes_comerciais` + função `is_supervisor_of()` + RLS updates em `leads` e `cotacoes`
- **Novo**: `src/hooks/useEquipeComercial.ts`
- **Editar**: `src/hooks/useVendasMetricas.ts` — filtro de equipe para supervisor
- **Editar**: `src/components/leads/LeadKanbanCard.tsx` — badge de vendedor
- **Editar**: `src/pages/vendas/Leads.tsx` — filtro automático por equipe
- **Editar**: `src/hooks/usePermissions.ts` — adicionar `isSupervisorVendas` e `canManageEquipe`

## Ordem de execução

1. Migration (tabela + função + RLS)
2. Hook `useEquipeComercial`
3. Ajustar `usePermissions` com flags de supervisor
4. Adaptar `Leads.tsx` e `LeadKanbanCard` para exibir vendedor
5. Adaptar métricas para escopo de equipe

