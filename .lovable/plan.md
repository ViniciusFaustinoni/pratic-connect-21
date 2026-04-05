

# Plano: Corrigir sync para todos os rastreadores comunicarem

## Resumo

Existem 3 correções a implementar no `sync-rastreadores`:

1. **Rede Veículos**: Ler URL do banco em vez de ENV (corrige 2.853 rastreadores)
2. **Softruck**: Resolver IMEIs brutos para hash IDs via API (corrige 4.996 rastreadores)
3. **Softruck**: Ler URL do banco em vez de ENV

---

## Correção 1: Ler ambiente do banco (ambas plataformas)

**Arquivo**: `supabase/functions/sync-rastreadores/index.ts`

Substituir `getPlataformasConfig()` (linhas 24-41) que lê de ENV vars inexistentes por uma função assíncrona que busca `rastreadores_config_plataformas` do banco e usa `ambiente_atual` + `api_url_producao`/`api_url_sandbox`. As credenciais vêm do `credenciais-hibridas.ts` (já usado no `rastreador-posicao`).

Isso corrige imediatamente a Rede Veículos (URL sandbox → produção) e garante que a Softruck também use a URL correta.

## Correção 2: Resolver device IDs Softruck automaticamente durante sync

**Arquivo**: `supabase/functions/sync-rastreadores/index.ts` — dentro de `syncSoftruck()`

Antes de buscar tracking, verificar se `plataforma_device_id` é um IMEI bruto (regex `^\d{10,}$`). Se for:

1. Chamar `GET /v2/devices/?filters[devices.imei][eq]={IMEI}&includes[vehicle][]=plate` com token Softruck
2. Se retornar resultado: extrair `device.id` (hash) e `relationships.vehicle.id`
3. Atualizar `rastreadores.plataforma_device_id` com o hash e `plataforma_veiculo_id` com o vehicle ID
4. Continuar com o tracking usando os IDs corretos
5. Se não encontrar: pular (marcar como falha)

Isso elimina a necessidade de rodar `popular-ids-softruck` separadamente — o sync se auto-corrige.

## Correção 3: Usar credenciais híbridas no sync

**Arquivo**: `supabase/functions/sync-rastreadores/index.ts`

Importar `getCredenciaisRedeVeiculos` e `getCredenciaisSoftruck` de `credenciais-hibridas.ts` (já usado no `rastreador-posicao`). Usar o token do banco em vez do ENV `REDE_VEICULOS_TOKEN`.

---

## Detalhes técnicos

### Alterações em `sync-rastreadores/index.ts`

1. **Importar** `getCredenciaisRedeVeiculos`, `getCredenciaisSoftruck` de `credenciais-hibridas.ts`
2. **Substituir** `getPlataformasConfig()` por função assíncrona que:
   - Busca `rastreadores_config_plataformas` do banco
   - Monta `baseUrl` com base em `ambiente_atual`
   - Busca credenciais via `credenciais-hibridas`
3. **Em `syncSoftruck()`** (linhas 268-278): antes do `if (!deviceId)`, adicionar bloco de resolução de IMEI:
   ```
   if (deviceId && /^\d{10,}$/.test(deviceId)) {
     // IMEI bruto → resolver via API
     const resolved = await resolveImeiToDeviceId(token, publicKey, baseUrl, deviceId);
     if (resolved) {
       // Atualizar DB e usar IDs corretos
       deviceId = resolved.deviceHashId;
       vehicleId = resolved.vehicleId;
     } else {
       // Pular — device não encontrado na Softruck
       continue;
     }
   }
   ```
4. **Em `syncRedeVeiculos()`** (linha 435): usar token do `credenciais-hibridas` em vez de `config.apiKey`
5. **Passar `supabase`** como parâmetro para `syncRedeVeiculos` (atualmente não recebe)

### Nova função auxiliar `resolveImeiToDeviceId`

```typescript
async function resolveImeiToDeviceId(
  token: string, publicKey: string, baseUrl: string, imei: string
): Promise<{ deviceHashId: string; vehicleId: string | null } | null>
```

Faz `GET /v2/devices/?filters[devices.imei][eq]={imei}&includes[vehicle][]=plate` e retorna o hash ID + vehicle ID.

### Arquivos alterados

- `supabase/functions/sync-rastreadores/index.ts` — todas as 3 correções

### Resultado esperado

- **Rede Veículos**: 2.853 rastreadores passam a sincronizar imediatamente (URL de produção)
- **Softruck**: A cada ciclo de sync (10 min), ~200 IMEIs são resolvidos automaticamente. Em ~4h, todos os ~5.000 terão device hash ID correto e começarão a reportar posição
- **Métricas**: O número de "comunicando" sobe de 63 para potencialmente milhares

