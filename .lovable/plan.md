# Correções pós-diagnóstico Softruck

## 1. Causa real do FAILED_DEVICE em IMEIs novos — incluir `tipoId` no criar-device

**Problema**: `softruck-ativar-dispositivo` chama `criar-device` sem `tipoId`. Softruck mai/26 passou a exigir `body.data[0].relationships.type`. Qualquer IMEI genuinamente novo na Softruck falha (caso 868018075843808, 6 tentativas, FAILED_DEVICE).

**Fix**:
- Resolver o `tipoId` GPS canônico uma única vez (constante baseada no que JÁ está em produção: devices existentes têm `relationships.type.id = "kov8pZ58aQ93KgV"`, vindo do GET buscar-device-imei do 843824). Confirmar via `listar-roles` ou consulta `/v2/devices/types` e fixar como constante `SOFTRUCK_DEVICE_TYPE_ID_GPS`.
- `supabase/functions/softruck-ativar-dispositivo/index.ts` linha 540-545: passar `tipoId: SOFTRUCK_DEVICE_TYPE_ID_GPS` no payload do criar-device.
- Após deploy, retentar manualmente o 868018075843808 e confirmar SUCCESS via read-back.

## 2. Reverter sintaxe dos 3 endpoints comprovadamente quebrados

Testes diretos confirmaram 400 validation_failed nestes endpoints — Softruck endureceu a validação SÓ neles:

| Endpoint | Arquivo:linha | Mudança |
|---|---|---|
| `/v2/enterprises` (listar/buscar) | `softruck-api/index.ts:363,372,379` e `rastreador-testar-conexao/index.ts:15` | Remover `attributes[]=…` (deixar payload default) |
| `/v2/chips` (listar/buscar) | `softruck-api/index.ts:717,727` | Remover `attributes[]=…` E `includes[device][]=…` (rejeitados juntos) |
| `/v2/users` (listar/buscar) | `softruck-api/index.ts:812,827` | Remover `attributes[]=…` |
| `softruck-validar-ids/index.ts:57` | mesmo padrão | Revisar conforme endpoint que valida |

Testar cada um após o fix (`listar-enterprises`, `listar-chips`, `listar-usuarios` → esperar 200).

## 3. Deixar como está — comprovadamente funcionando

Testes diretos retornaram 200 nestes (NÃO mexer):

- `/v2/devices?attributes[]=&includes[vehicle][]=plate&includes[chip][]=serial` (listar-devices, linha 563) ✅
- `/v2/devices?...&includes[vehicle][]=plate` (buscar-device-imei, linha 574; resolver linhas 136/138; rastreador-posicao:239; softruck-reconciliar-pending:147; sync-rastreadores:120) ✅
- `/v2/vehicles/{id}?includes[devices]=csv` (buscar-veiculo-id, linha 430) ✅
- `/v2/vehicles` sem `attributes` (listar-veiculos, linha 412) ✅

Os demais 6 sites não-testados que usam `/v2/devices`, `/v2/vehicles/{id}/associations/*`, `/v2/vehicles/{id}/tracking/{deviceId}` ou `/v2/vehicles?includes[X][]=` ficam intocados — não há sinal de quebra; testar só se incidente real aparecer.

## 4. Atualizar a memória `mem://logic/integrations/softruck-api-sintaxe-query` com o modelo real

A versão atual diz "Softruck rejeitou array-bracket; usa CSV". É falso e leva a refactor errado (foi o que aconteceu nos 3 GETs). Reescrever para modelo per-endpoint baseado em evidência:

```
Softruck v2 (mai/26): validação é POR ENDPOINT, não uniforme.

- /v2/devices: aceita tudo (attributes[]=, includes[X][]=, CSV).
- /v2/vehicles (listar): rejeita attributes[]= e attributes=csv. Usar sem attributes.
- /v2/vehicles/{id}: aceita includes[X]=csv (NÃO array-bracket; "id" rejeitado no enum).
- /v2/enterprises, /v2/users: rejeitam attributes[]=.
- /v2/chips: rejeitam attributes[]= E includes[device][]=.

POST /v2/devices: relationships.type é OBRIGATÓRIO. Todo criar-device tem que passar tipoId (constante SOFTRUCK_DEVICE_TYPE_ID_GPS). Sem ele → 400 validation_failed "body.data[0].relationships.type is required" e FAILED_DEVICE no rastreador.

Antes de migrar qualquer endpoint, TESTAR com curl_edge_functions — não assumir uniformidade.
```

## 5. Não-ações conscientes

- As 2 falhas antigas com `softruck_response_raw=NULL` (imeis 356430070876858 e 868018074976674, criados em 04–05/abr/2026) são **lotes legados** retentados pelo cron em 01/06 03h, antes do envelope estar deployado. Não é regressão — não tocar.
- Os 6 sites não-testados acima ficam como estão. Documentar como "verificar caso a caso se incidente surgir".

## Ordem de execução

1. Resolver `SOFTRUCK_DEVICE_TYPE_ID_GPS` (chamar `listar-roles` ou `/v2/devices/types`; fallback: reusar `kov8pZ58aQ93KgV` que já está em produção).
2. Item 1 (criar-device + tipoId) — deploy.
3. Item 2 (3 endpoints quebrados) — deploy.
4. Retentar 868018075843808 → confirmar SUCCESS.
5. Item 4 (memória).

## Critérios de aceite

- `curl_edge_functions listar-enterprises`, `listar-chips`, `listar-usuarios` → 200.
- 868018075843808 final: `softruck_integration_status='SUCCESS'`, `plataforma_device_id` populado.
- Novo IMEI (qualquer um nunca antes visto na Softruck) ativado via `softruck-ativar-dispositivo` → SUCCESS (não FAILED_DEVICE).
- Memória `softruck-api-sintaxe-query` reflete modelo per-endpoint + regra `relationships.type` obrigatório em POST /v2/devices.
