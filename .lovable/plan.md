

# Filtro por Clique nos Cards de Métricas de Rastreadores

## Problema
Os cards de métricas (Total, Online, Atenção, Offline, Estoque) são apenas visuais — não aplicam filtro ao serem clicados.

## Solução

### Arquivo: `src/components/rastreadores/RastreadorMetrics.tsx`

1. Adicionar prop `onFilterClick: (filter: Partial<RastreadorFilters>) => void` e `activeFilter?: string` ao componente
2. Adicionar um campo `filterKey` a cada métrica que mapeia para os filtros corretos:
   - **Total**: limpa todos os filtros (reset)
   - **Online**: `{ comunicacao: 'online', status: ['instalado'] }`
   - **Atenção**: `{ comunicacao: 'atencao', status: ['instalado'] }` (novo valor, ver abaixo)
   - **Offline**: `{ comunicacao: 'offline', status: ['instalado'] }`
   - **Estoque**: `{ status: ['estoque'] }`
3. Tornar os cards clicáveis com `cursor-pointer` e visual de card ativo (borda highlight)

### Arquivo: `src/hooks/useRastreadores.ts`

Estender o tipo `comunicacao` de `'online' | 'offline' | 'todos'` para incluir `'atencao'` (1-24h sem sinal). Ajustar a query para filtrar:
- `online`: `ultima_comunicacao >= 1h atrás` (ou threshold existente)
- `atencao`: `ultima_comunicacao` entre 1h e 24h
- `offline`: `ultima_comunicacao < 24h atrás` ou NULL

### Arquivo: `src/pages/monitoramento/Rastreadores.tsx`

Passar `onFilterClick` e `activeFilter` para `RastreadorMetrics`, conectando ao `setFilters` existente.

## Detalhes Técnicos

```typescript
// RastreadorMetrics - cada card ganha filterKey
{
  label: 'Online',
  filterKey: 'online',
  filterValue: { comunicacao: 'online', status: ['instalado'] },
  ...
}

// onClick handler
onClick={() => {
  if (activeFilter === metric.filterKey) {
    onFilterClick({}); // toggle off = reset
  } else {
    onFilterClick(metric.filterValue);
  }
}

// Visual: ring-2 ring-offset-2 no card ativo
```

