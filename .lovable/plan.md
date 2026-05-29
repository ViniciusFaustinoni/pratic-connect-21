## Objetivo

Interromper o loop de re-vinculação do device IMEI `359366080311592` ao vehicle `PR97L1qVkzLnlrm` (RJS7E82) e mover o vínculo correto para o LTC8G02 (Daniele) na Softruck. Sem mexer em nada além do caso.

## Causa raiz (resumo)

`veiculos.softruck_vehicle_id` do LTC8G02 está apontando para `PR97L1qVkzLnlrm` (ID do vehicle do RJS7E82). Qualquer chamada a `softruck-ativar-dispositivo` aciona o auto-correção do `_shared/softruck-corrigir.ts`, que usa esse ID local como alvo — e re-vincula o device ao vehicle errado. O cron `cron-softruck-reconciliar-pending` por si só não re-vincula (rejeita com `placa_divergente`), mas mantém o rastreador girando em PENDING.

## Passos

### Passo A — Sair da fila do cron (segurança)

Atualizar SOMENTE o rastreador `9ac6603f-1a16-4596-801b-fe4661379232`:
```
softruck_integration_status = 'FAILED_VINCULO'
```
Efeito: cron não processa mais (filtro é `PENDING/pending`), aparece como caso manual no drawer. Não toca em nenhum outro rastreador.

Comunicar ao Monitoramento: **não clicar em "Reprocessar Sincronização Softruck"** até o Passo D concluir, senão o loop re-acontece.

### Passo B — Criar vehicle real do LTC8G02 na Softruck

Edge `softruck-corrigir-vinculo` em modo apropriado, ou chamada direta via `softruck-api` action `criar-veiculo`, com a placa LTC8G02, chassi/marca/modelo/cor do veículo `bb051923-978b-46bc-ac47-9a5804650563`. Capturar o novo `softruck_vehicle_id` retornado (será diferente de `PR97L1qVkzLnlrm`).

### Passo C — Mover device e Daniele para o vehicle novo

Na ordem:
1. (Daniele) Se houver usuário associado da Softruck vinculado ao vehicle RJS7E82, desvincular usuário Daniele de `PR97L1qVkzLnlrm`.
2. (Device) Desvincular `vG1VQNYazALAJkn` de `PR97L1qVkzLnlrm` (via `listar-devices-veiculo` para pegar `associationId` + `desvincular-device`).
3. Vincular device `vG1VQNYazALAJkn` ao vehicle novo do LTC8G02 (`associarDevice`).
4. Vincular Daniele ao vehicle novo.
5. Read-back: GET `/devices/{deviceId}?includes[vehicle][]=plate` → confirmar `relationships.vehicle.id == novoVehicleId` e `plate == LTC8G02`.

### Passo D — Sincronizar banco local

UPDATE `veiculos` do LTC8G02 (`bb051923-…`):
```
softruck_vehicle_id = <novoVehicleId>
```

UPDATE `rastreadores` (`9ac6603f-…`):
```
plataforma_veiculo_id = <novoVehicleId>
softruck_integration_status = 'SUCCESS'
softruck_response_raw = { ...nota correção manual, reconciliado_em, vehicle_anterior: 'PR97L1qVkzLnlrm', vehicle_novo: '<novoVehicleId>' }
softruck_tentativas = 0
```

Não tocar no veículo/rastreador do RJS7E82 (Daniele não era do RJS7E82 originalmente; o device é que estava no lugar errado).

### Passo E — Verificação final

1. Read-back GET device por IMEI → vehicle == LTC8G02.
2. Cron `cron-softruck-reconciliar-pending` no próximo tick não deve pegar o rastreador (status SUCCESS).
3. Botão "Reprocessar" agora é seguro: `veiculos.softruck_vehicle_id` local = vehicle correto, então mesmo se auto-correção rodar, ela aponta para o vehicle certo.

## Fora de escopo (não tocar agora)

- Refactor do `_shared/softruck-corrigir.ts` para distinguir "desvinculo intencional" de "falha" — é o bug estrutural, mas fica para depois. Pode ser registrado em memória depois da correção do caso.
- Outros rastreadores em PENDING — não filtrar nem rodar em lote.
- Rede Veículos e Hinova — intocados.

## Confirmações necessárias antes de executar

1. OK em rodar Passo A agora (UPDATE direto via insert tool)?
2. OK em prosseguir com Passos B-D em sequência depois do A confirmar?
