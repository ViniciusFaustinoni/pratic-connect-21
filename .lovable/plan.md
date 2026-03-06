

# Mapa de Veículos — Busca por Nome + Aba Padrão

## Estado Atual

O código já implementa:
- Aba "Veículos" como padrão (`useState("veiculos")`)
- Busca por placa com mínimo 3 caracteres
- Exibição de veículo único no mapa

## Alterações Necessárias

### 1. Buscar por placa OU nome do associado (`Mapa.tsx`)

Atualmente a query usa apenas `.ilike("placa", ...)`. Alterar para usar `.or()` combinando busca por placa e por nome do associado:

```
.or(`placa.ilike.%${termo}%,associado_nome.ilike.%${termo}%`)
```

Atualizar o placeholder do input para: `"Buscar por placa ou nome do associado..."`.

### 2. Exibir associado_nome nos resultados

Já exibe (`v.associado_nome`), mas quando a busca for por nome e retornar múltiplos veículos do mesmo associado, o operador verá todos listados com placa + modelo + nome, e escolhe qual.

### 3. Garantir aba "Veículos" como padrão

O `useState` já define `"veiculos"`, mas vou confirmar que não há nenhum `useEffect` ou lógica que mude isso. Se necessário, forçar.

## Arquivo

| Arquivo | Ação |
|---|---|
| `src/pages/monitoramento/Mapa.tsx` | Alterar query de busca para incluir nome do associado + atualizar placeholder |

1 arquivo, alteração pontual (~3 linhas).

