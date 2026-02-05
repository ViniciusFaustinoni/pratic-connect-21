

## Remover Filtro Superior de Tabs da Fila de Vistorias

### Problema Identificado

A página **Fila de Vistorias** (`src/pages/monitoramento/FilaVistorias.tsx`) possui um componente de abas (Tabs) na parte superior com os filtros:
- Pendentes
- Em Campo
- Aguard. Análise
- Auto Vistoria
- Concluídas

O usuário deseja remover essas abas de filtro.

### Solução Proposta

Remover completamente o componente `TabsList` com as abas de status, mantendo apenas a área de filtros secundários (busca por texto, tipo, região, data, vistoriador) e a tabela de resultados. A listagem mostrará todas as vistorias juntas, sem filtro por status.

### Mudanças Técnicas

**Arquivo:** `src/pages/monitoramento/FilaVistorias.tsx`

1. **Remover a TabsList (linhas 439-460)**
   - Excluir completamente o bloco de `<TabsList>` com as abas

2. **Ajustar o filtro de vistorias**
   - Modificar a lógica de `vistoriasFiltradas` para não filtrar por `activeTab`
   - Remover a variável `activeTab` e seu estado

3. **Simplificar estrutura**
   - Manter o componente `Tabs` se necessário para estrutura, ou substituir por `div` simples
   - Preservar os filtros secundários (busca, tipo, região, data, vistoriador)
   - Manter a tabela de resultados mostrando todas as vistorias

### Resultado Visual Esperado

```
┌────────────────────────────────────────────────────────────────────────┐
│ Home > Monitoramento > Vistorias                                       │
│                                                                        │
│ Fila de Vistorias                                                      │
│ Gerencie vistorias pendentes, agendadas e em análise                   │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐   │
│ │ 🔍 Buscar...  │ Todos os tipos │ Todas as regiões │ Data │ Todos │   │
│ └──────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐   │
│ │ Protocolo │ Cliente  │ Veículo │ Status   │ Data    │ Ações    │   │
│ │ VIS-...   │ Cliente1 │ Fiat... │ Pendente │ ...     │ ...      │   │
│ │ VIS-...   │ Cliente2 │ VW...   │ Agendada │ ...     │ ...      │   │
│ └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Impacto

- As abas de filtro superior (Pendentes, Em Campo, etc.) serão removidas
- Todas as vistorias serão exibidas em uma única lista
- Os filtros secundários (busca, tipo, região, data, vistoriador) continuam funcionando
- Interface mais limpa e simplificada
- Os badges de contagem por status também serão removidos

### Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/monitoramento/FilaVistorias.tsx` | Remover TabsList e ajustar filtros |

