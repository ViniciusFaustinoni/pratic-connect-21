## Objetivo

Refletir no banco local o vínculo já feito na Softruck para SWQ4I01, RFV2A76 e LRA9681. Sem nenhuma alteração na Softruck.

## Execução (uma placa por vez, com reporte intermediário)

Para cada placa, na ordem **SWQ4I01 → RFV2A76 → LRA9681**:

1. **Descoberta** — Resolver o `softruck_vehicle_id` real consultando o vínculo do IMEI do rastreador:
   - SWQ4I01 → IMEI `862667083422561`
   - RFV2A76 → IMEI `357789645530731`
   - LRA9681 → IMEI `862667083433089`
   - Caminho: edge `softruck-detalhes-vinculo` por IMEI (retorna `vehicle.id` + `vehicle.plate`); fallback `softruck-buscar-dispositivo` se necessário.

2. **Validação anti-engano** — Confirmar que `vehicle.plate` retornado bate com a placa alvo. Se divergir, **parar** e reportar (não escrever no banco).

3. **UPDATE atômico** no mesmo migration por placa:
   - `veiculos.softruck_vehicle_id = <id_real>`
   - `rastreadores.plataforma_veiculo_id = <id_real>`
   - `rastreadores.softruck_integration_status = 'SUCCESS'`
   - `rastreadores.softruck_tentativas = 0`
   - `rastreadores.softruck_response_raw = { manual_resync_at, motivo:'saneamento_pos_colisao_20260529', vehicle_id, plate_softruck }`

4. **Read-back** — Re-consultar `softruck-detalhes-vinculo` pelo `vehicle_id` recém-gravado e confirmar:
   - `vehicle.plate` == placa alvo
   - `device.imei` == IMEI esperado
   - Reportar resultado antes de partir para a próxima placa.

5. **Guard de unicidade já ativo** — O trigger `trg_guard_softruck_vehicle_id_unico` (instalado no saneamento anterior) bloqueia qualquer colisão acidental durante o UPDATE.

## Critério de parada

Se em qualquer placa o `softruck-detalhes-vinculo` retornar `found:false`, placa divergente, device em outro vehicle, ou IMEI sem vehicle → **abortar essa placa**, manter `FAILED_VINCULO`, reportar e aguardar instrução. Não prosseguir para a próxima.

## Fora de escopo

- Nenhuma chamada à Softruck que altere estado (sem POST/PATCH/DELETE em vehicles, devices ou users).
- TUG9J61 (badge "Escolha de Vistoria" durante assinatura) fica para a próxima rodada.
