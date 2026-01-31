

# Plano de Correção: Rota `/vendas/cotador` Não Definida

## Resumo do Problema

A rota `/vendas/cotador` é referenciada em **múltiplos lugares do sistema** mas **não existe no arquivo de rotas** (`App.tsx`):

### Onde a Rota é Usada (Quebrada)
| Local | Arquivo | Referência |
|-------|---------|------------|
| Dashboard - Ações Rápidas | `src/pages/Dashboard.tsx` | `url: '/vendas/cotador'` |
| Busca Global | `src/components/layout/GlobalSearch.tsx` | `url: '/vendas/cotador'` (2x) |
| Breadcrumb | `src/components/layout/GlobalBreadcrumb.tsx` | `'/vendas/cotador': { label: 'Cotador' }` |
| Kanban de Leads | `src/pages/vendas/LeadKanban.tsx` | `navigate('/vendas/cotador', { state: {...} })` |

### Situação Atual
- **Arquivo existe:** `src/pages/vendas/Cotador.tsx` (1572 linhas - cotador completo/avançado)
- **Arquivo NÃO importado** no `App.tsx`
- **Rota NÃO registrada** no `App.tsx`
- **Rota existente similar:** `/vendas/cotacao` → `Cotacao.tsx` (422 linhas - stepper simples)

## Análise

O arquivo `Cotador.tsx` foi criado mas **nunca foi integrado às rotas**. Isso faz com que:
1. Clicar em "Nova Cotação" no Dashboard leva a uma página 404
2. Busca global "Cotador" leva a 404
3. Ação "Criar cotação" no Kanban de Leads leva a 404
4. Breadcrumb mostra "Cotador" mas a rota não existe

## Solução

Adicionar a importação e rota do `Cotador.tsx` no arquivo `App.tsx`.

### Arquivo: `src/App.tsx`

**1. Adicionar Import (após linha 43):**
```typescript
import Cotador from "./pages/vendas/Cotador";
```

**2. Adicionar Rota (após linha 346):**
```typescript
<Route path="/vendas/cotador" element={<Cotador />} />
```

## Alterações Necessárias

| Arquivo | Ação | Linhas |
|---------|------|--------|
| `src/App.tsx` | Adicionar import `Cotador` | ~43 |
| `src/App.tsx` | Adicionar Route `/vendas/cotador` | ~347 |

## Resultado Esperado

- Botão "Nova Cotação" no Dashboard funcionará corretamente
- Busca global navegará para o Cotador
- Kanban de Leads abrirá cotação com dados do lead
- Breadcrumb exibirá corretamente

## Validação

Após a correção, testar:
1. Dashboard → Clicar "Nova Cotação" → Deve abrir `/vendas/cotador`
2. Busca Global (Cmd+K) → Digitar "cotador" → Navegar → Deve abrir a página
3. Kanban de Leads → Arrastar lead para "Cotação" → Deve abrir cotador com dados

