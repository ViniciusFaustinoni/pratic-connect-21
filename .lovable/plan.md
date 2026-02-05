
## Problema Identificado

O usuário quer remover o **filtro superior** (ToggleGroup com abas de status) da página de Vistorias. Atualmente, na linha 105-136, há um filtro que permite selecionar entre:
- Todos
- Pendentes
- Em Andamento
- Concluídas

## Solução Proposta

**Remover completamente o ToggleGroup e manter apenas:**
1. ✅ Cards de métricas (Pendentes, Em Andamento, Concluídas, Reprovadas)
2. ✅ Barra de busca (para filtrar por placa/nome)
3. ❌ Remover: ToggleGroup com os filtros de status

### Mudanças Necessárias

**Arquivo:** `src/pages/monitoramento/Vistorias.tsx`

**Alterações:**

1. **Remover estado de filtro** (linha 21):
   - Eliminar `const [filter, setFilter] = useState<FilterStatus>('todos');`
   - Manter o estado `search`

2. **Remover parametrização de filtro no hook** (linha 27):
   - Mudar: `useVistorias({ status: filter, search })`
   - Para: `useVistorias({ status: 'todos', search })` (mostrar todas as vistorias)
   - Ou: `useVistorias({ search })` se o hook aceitar sem status

3. **Remover ToggleGroup** (linhas 105-136):
   - Eliminar todo o bloco `<ToggleGroup>` 
   - Manter apenas a barra de busca com seu container flex

4. **Remover ToggleGroup do import** (linha 7):
   - Remover: `ToggleGroup, ToggleGroupItem`

5. **Simplificar condição de mensagem vazia** (linhas 150-152):
   - Remover a verificação condicional `filter !== 'todos'` já que não haverá filtro
   - Mensagem padrão: "Comece realizando uma nova vistoria."

### Estrutura Resultante

```
┌─────────────────────────────────────────┐
│ Vistorias                         [Novo] │
│ Gerencie vistorias...                   │
└─────────────────────────────────────────┘

[Pendentes 5] [Em Andamento 3] [Concluídas 12] [Reprovadas 1]

[🔍 Buscar por placa...        ]

├─ Vistoria 1
├─ Vistoria 2
└─ Vistoria 3
```

### Impacto

- ✅ Interface mais limpa e focada
- ✅ Usuário visualiza todas as vistorias por padrão
- ✅ Pode filtrar por texto (placa/nome)
- ✅ Métricas ainda servem como informação visual
- ⚠️ Sem filtro por status (se isso for necessário, considerar adicionar dropdown alternativo)

### Arquivos Afetados

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `src/pages/monitoramento/Vistorias.tsx` | 7, 21, 27, 105-136, 150-152 | Remover filter state, ToggleGroup e imports |

