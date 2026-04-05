

# Fix: Rastreadores Offline — `plataforma_veiculo_id` Não Populado

## Problema

Todos os 5.072 rastreadores Softruck estão offline porque `plataforma_veiculo_id` é NULL em todos. O `sync-rastreadores` exige ambos `plataforma_device_id` E `plataforma_veiculo_id` para sincronizar, então zero rastreadores passam o filtro.

## Causa Raiz

O fluxo de instalação/cadastro nunca popula `plataforma_veiculo_id`. O campo `plataforma_device_id` está preenchido (com o IMEI), mas o ID do veículo na plataforma Softruck não é salvo.

## Solução em 2 Partes

### Parte 1: Flexibilizar o filtro do sync (correção imediata)

Alterar `sync-rastreadores` para aceitar rastreadores Softruck que tenham **apenas** `plataforma_device_id` (sem exigir `plataforma_veiculo_id`). A API Softruck pode ser consultada usando apenas o device ID — o `plataforma_veiculo_id` pode ser obtido via lookup e salvo automaticamente.

**Arquivo**: `supabase/functions/sync-rastreadores/index.ts`

- Linha 447-449: Alterar filtro para aceitar Softruck com apenas `plataforma_device_id`
- Linha 188-197: Antes de pular por falta de `vehicleId`, fazer lookup automático via `softruck-api` (operação `getVehicleByDevice`) e salvar o `plataforma_veiculo_id` no banco
- Se a API não suportar lookup por device, usar o `plataforma_device_id` como `vehicleId` no tracking (muitas APIs Softruck aceitam o IMEI como identificador)

### Parte 2: Fallback — usar device ID como vehicle ID

Se a Softruck aceitar o device ID no endpoint de tracking (o que é comum), a correção mais simples é:

**Arquivo**: `supabase/functions/sync-rastreadores/index.ts`

- Linha 190: `const vehicleId = rast.plataforma_veiculo_id || rast.plataforma_device_id;`
- Linha 448-449: `return !!r.plataforma_device_id;` (remover exigência de `plataforma_veiculo_id`)

Isso desbloquearia imediatamente todos os 5.072 rastreadores para sincronização.

## Arquivos Alterados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/sync-rastreadores/index.ts` | Flexibilizar filtro e fallback de vehicle ID |

## Detalhes Técnicos

### Filtro (linha ~447-452)
```typescript
// Antes:
if (r.plataforma === 'softruck') {
  return r.plataforma_device_id && r.plataforma_veiculo_id;
}

// Depois:
if (r.plataforma === 'softruck') {
  return !!r.plataforma_device_id;
}
```

### Sync function (linha ~190)
```typescript
// Antes:
const vehicleId = rast.plataforma_veiculo_id;

// Depois:
const vehicleId = rast.plataforma_veiculo_id || rast.plataforma_device_id;
```

Após deploy, o cron de sincronização (a cada ~7 min) começará a buscar posições de todos os rastreadores. Se a API Softruck rejeitar o device ID como vehicle ID, será necessário investigar o endpoint correto da Softruck e criar um passo de auto-discovery do vehicle ID.

