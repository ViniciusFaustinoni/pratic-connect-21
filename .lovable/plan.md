

# Corrigir Espaço Vazio no Layout do Resumo

## Causa

O layout usa `grid lg:grid-cols-5`. O card de Resumo (`lg:col-span-3`) tem pouco conteúdo, mas o card de Status + Ações (`lg:col-span-2`) é alto (4 itens de status + botões + banner de ativação pendente). O grid força ambas as colunas à mesma altura, criando o espaço vazio visível dentro do card de Resumo.

## Correção

### `src/pages/cadastro/VistoriaCompletaAnalise.tsx`

Adicionar `items-start` ao container grid (linha 360) para que cada coluna tenha altura independente:

```tsx
<div className="grid gap-4 lg:grid-cols-5 items-start">
```

Isso faz o card de Resumo ocupar apenas a altura necessária para seu conteúdo, sem esticar para igualar a coluna do Status.

| Arquivo | Ação |
|---|---|
| `src/pages/cadastro/VistoriaCompletaAnalise.tsx` | Adicionar `items-start` ao grid do resumo + status (linha 360) |

