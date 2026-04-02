

# Separar Base Antiga (SGA/API) dos Associados Novos (Cotação)

## Resumo

Adicionar coluna `origem_cadastro` na tabela `associados` para distinguir registros importados via API/SGA dos criados internamente via cotação. Criar página "Base Antiga" no menu Cadastro com lista, busca e modal de detalhes. Filtrar a área "Associados" para mostrar apenas registros novos. Atualizar buscas do sistema para pesquisar em ambas as áreas.

## Alterações

### 1. Migration — coluna `origem_cadastro`

```sql
ALTER TABLE associados 
  ADD COLUMN IF NOT EXISTS origem_cadastro text NOT NULL DEFAULT 'interno';

-- Marcar todos que vieram da API (têm codigo_hinova ou data_cadastro_sga)
UPDATE associados 
  SET origem_cadastro = 'api_externa' 
  WHERE codigo_hinova IS NOT NULL 
     OR data_cadastro_sga IS NOT NULL;
```

Valores: `'api_externa'` (importados SGA) | `'interno'` (novos, criados via cotação)

### 2. Edge Function `api-externa/index.ts`

No POST de associados, adicionar `origem_cadastro: 'api_externa'` ao `insertData` (linha ~92).

### 3. Menu — AppSidebar.tsx

Adicionar item "Base Antiga" no grupo Cadastro:
```
{ title: 'Base Antiga', url: '/cadastro/base-antiga', icon: Archive }
```

### 4. Nova página — `src/pages/cadastro/BaseAntiga.tsx`

- Lista de associados com `origem_cadastro = 'api_externa'`
- Busca por nome, CPF, placa (join veiculos), chassi
- Badge "SGA" nos registros
- Ao clicar: modal com abas (Dados, Veículos, Rastreadores, Boletos, Plano)
- Paginação com `{ count: 'exact' }`

### 5. Hook — `src/hooks/useBaseAntiga.ts`

- `useBaseAntigaAssociados(filters, pagination)` — query com `origem_cadastro = 'api_externa'`
- `useBaseAntigaDetalhe(id)` — busca associado + veículos + rastreadores + cobrancas + plano

### 6. Filtrar Associados existentes

Em `useAssociados` (src/hooks/useAssociados.ts), adicionar filtro:
```ts
query = query.eq('origem_cadastro', 'interno');
```

Em `useAssociadosContagem`, adicionar `.eq('origem_cadastro', 'interno')` a todas as queries de contagem.

### 7. Buscas que devem pesquisar nas DUAS áreas

Os seguintes hooks/componentes fazem busca em associados e devem **remover** qualquer filtro de `origem_cadastro` (ou seja, buscar em todos):

| Hook/Componente | Uso |
|---|---|
| `useAssociadoSearch.ts` | Substituição, Inclusão, Troca titularidade, Indicador |
| `useVerificarVeiculoSGA.ts` | Pre-check de placa no cotador |
| `buscarAssociadoPorCpf()` | Busca standalone por CPF |
| `OutrasEntradasMenu.tsx` | Busca para operações |

Esses hooks já buscam sem filtro de origem, então **não precisam de alteração** — continuam pesquisando toda a tabela.

### 8. Rota — App.tsx

```tsx
<Route path="/cadastro/base-antiga" element={<BaseAntiga />} />
```

### 9. Breadcrumb — GlobalBreadcrumb.tsx

Adicionar entrada `'/cadastro/base-antiga': { label: 'Base Antiga' }`.

## Arquivos afetados

| Arquivo | Tipo |
|---|---|
| Migration SQL | Nova coluna + update registros existentes |
| `supabase/functions/api-externa/index.ts` | +1 campo no insert |
| `src/hooks/useAssociados.ts` | Filtro `origem_cadastro = 'interno'` |
| `src/hooks/useBaseAntiga.ts` | Novo hook |
| `src/pages/cadastro/BaseAntiga.tsx` | Nova página |
| `src/components/layout/AppSidebar.tsx` | +1 item menu |
| `src/components/layout/GlobalBreadcrumb.tsx` | +1 breadcrumb |
| `src/App.tsx` | +1 rota |

## Impacto nas buscas do sistema

As buscas em `useAssociadoSearch`, `buscarAssociadoPorCpf` e `useVerificarVeiculoSGA` continuam pesquisando **toda** a tabela (sem filtro de origem), garantindo que substituição de placa, troca de titularidade e inclusão de veículo encontrem associados de ambas as áreas.

