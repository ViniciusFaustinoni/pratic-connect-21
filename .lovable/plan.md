

# Plano: Tornar Solicitações IA Acessíveis e Visíveis

## Problema Identificado

O sinistro **foi registrado corretamente** na tabela `chat_solicitacoes_ia` com status `pendente`. O fluxo está funcionando conforme projetado:

| Etapa | Status |
|-------|--------|
| Associado conversou com IA | ✅ OK |
| IA coletou dados do sinistro | ✅ OK |
| Solicitação criada com ID `62490bb2-0f30-43ed-bc44-30cb53a93be6` | ✅ OK |
| Solicitação com status `pendente` | ✅ OK |
| Sinistro não criado na tabela `sinistros` | ⏳ **Esperado** - Aguarda aprovação do diretor |

**Porém**, o diretor não consegue aprovar porque:

1. **A tela de aprovação não está no menu** - A rota `/diretoria/solicitacoes-ia` existe mas não aparece no menu lateral
2. **Não há indicador visual** - Nenhum badge ou notificação alerta sobre solicitações pendentes

## Solução

### 1. Adicionar Item ao Menu da Diretoria

Incluir "Solicitações IA" no menu lateral com badge de contagem de pendentes:

**Arquivo:** `src/components/layout/AppSidebar.tsx` (linha ~358)

```typescript
items: [
  { title: 'Dashboard', url: '/diretoria', icon: BarChart3 },
  { title: 'Solicitações IA', url: '/diretoria/solicitacoes-ia', icon: Bot }, // NOVO
  { title: 'Produtos', url: '/diretoria/produtos', icon: Package },
  // ... resto
],
```

### 2. Adicionar Badge de Contagem no Menu

Criar hook para contar solicitações pendentes e exibir badge:

**Arquivo:** `src/hooks/useSolicitacoesIAPendentes.ts` (novo)

```typescript
export function useSolicitacoesIAPendentes() {
  return useQuery({
    queryKey: ['solicitacoes-ia-pendentes-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('chat_solicitacoes_ia')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente');
      return count || 0;
    },
    refetchInterval: 30000, // Atualizar a cada 30s
  });
}
```

### 3. Adicionar ao Breadcrumb

**Arquivo:** `src/components/layout/GlobalBreadcrumb.tsx`

```typescript
'/diretoria/solicitacoes-ia': { label: 'Solicitações IA' },
```

### 4. Adicionar Notificação no Dashboard Principal

Exibir um alerta no dashboard quando houver solicitações pendentes:

**Arquivo:** `src/pages/Index.tsx` ou componente de alertas

Card de alerta com link direto para a tela de aprovação.

## Fluxo Corrigido

```text
ANTES:
┌────────────────────┐     ┌────────────────────┐
│ Solicitação criada │────►│ Diretor NÃO SABE   │ ❌
│ status: pendente   │     │ onde aprovar       │
└────────────────────┘     └────────────────────┘

DEPOIS:
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│ Solicitação criada │────►│ Badge (2) aparece  │────►│ Diretor aprova     │ ✅
│ status: pendente   │     │ no menu Diretoria  │     │ Sinistro criado    │
└────────────────────┘     └────────────────────┘     └────────────────────┘
```

## Alterações de Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Adicionar item "Solicitações IA" no menu Diretoria |
| `src/hooks/useSolicitacoesIAPendentes.ts` | Criar hook para contagem de pendentes |
| `src/components/layout/GlobalBreadcrumb.tsx` | Adicionar label do breadcrumb |
| `src/pages/Index.tsx` | (Opcional) Adicionar alerta de solicitações pendentes |

## Ação Imediata (Workaround)

Enquanto a implementação não for feita, o diretor pode acessar diretamente:

**URL: `/diretoria/solicitacoes-ia`**

Na tela, a solicitação do sinistro `62490bb2...` estará na aba "Pendentes" aguardando aprovação.

## Resultado Esperado

Após as alterações:

1. Menu Diretoria exibe "Solicitações IA" com badge (1) indicando pendência ✅
2. Diretor clica e vê a solicitação de sinistro pendente ✅
3. Diretor clica "Aprovar" ✅
4. Edge Function `aprovar-solicitacao-ia` cria o sinistro real com protocolo SIN-XXXXXXXX-XXXX ✅
5. Sinistro aparece na lista `/eventos/sinistros` ✅

