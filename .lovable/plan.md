

# Remover Regiões do nível do Plano

## Contexto

Regiões já foram movidas para a elegibilidade individual de cada cobertura e benefício. O bloco "Regiões Disponíveis" no formulário de plano e a tabela `planos_regioes` no motor de cotação são agora redundantes.

## Alterações

### 1. `PlanoFormSheet.tsx` — Remover bloco de Regiões

- Remover state `selRegioes` / `setSelRegioes`
- Remover carregamento de `planos_regioes` no `queryFn`
- Remover `setSelRegioes` no `useEffect`
- Remover inserção/deleção de `planos_regioes` no `saveMutation` (tanto create quanto update)
- Remover o bloco visual inteiro (BLOCO 3: Regiões, linhas ~248-267)
- Remover import de `useRegioes` se não usado em outro lugar do arquivo

### 2. `usePlanosCotacao.ts` — Remover filtro por `planos_regioes`

- Remover `planos_regioes (regiao_id)` do select da query (linha ~171)
- Remover o bloco de filtro "Filtrar por regiões disponíveis" (linhas ~443-446+) que descarta planos sem match de região
- A filtragem regional agora acontece no nível de cada cobertura/benefício via `entity_eligibility_rules`

### 3. `LinhasPlanos.tsx` — Limpar referências na exclusão

- Remover `await supabase.from('planos_regioes').delete()` nas mutations de delete (linhas 112, 132) — dados órfãos serão ignorados

### 4. Outros arquivos (manter por ora)

- `usePlansAdmin.ts`, `PlanosConfig.tsx`, `usePlans.ts`, `usePlanosAdmin.ts` — são telas legadas (admin antigo). Podem ser limpos depois sem impacto funcional.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/gestao-comercial/PlanoFormSheet.tsx` | Remover estado, persistência e UI de regiões |
| `src/hooks/usePlanosCotacao.ts` | Remover filtro de planos por `planos_regioes` |
| `src/components/gestao-comercial/LinhasPlanos.tsx` | Remover delete de `planos_regioes` nas exclusões |

