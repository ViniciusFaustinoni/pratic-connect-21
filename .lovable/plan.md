
Corrigir o fluxo Softruck para usar o vínculo local do veículo como base de reconciliação e preencher os IDs da plataforma que faltam.

1. Diagnóstico confirmado
- O sistema mostra rastreador + plataforma + veículo porque o vínculo local existe em `rastreadores.veiculo_id`.
- Isso não basta para a API da Softruck: o endpoint de tracking exige o par real da plataforma `deviceId + vehicleId`.
- Hoje há `5072` rastreadores Softruck instalados com `plataforma_device_id` e `veiculo_id`, mas só `73` com `rastreadores.plataforma_veiculo_id`.
- Portanto, a tela lista corretamente os itens, mas o sync não consegue consultar posição para a grande maioria.
- Não vou repetir o fallback errado `deviceId => vehicleId`; ele já gerou 404/429. A correção precisa popular o `vehicleId` correto.

2. O que implementar
- Reaproveitar o vínculo local do veículo para reconciliar a Softruck:
  - usar `rastreadores.veiculo_id`
  - ler `veiculos.placa` e `veiculos.softruck_vehicle_id`
  - localizar ou criar o veículo na Softruck por placa
  - associar o device existente ao vehicle correto
  - persistir os IDs em:
    - `rastreadores.plataforma_veiculo_id`
    - `veiculos.softruck_vehicle_id`
    - opcionalmente normalizar `rastreadores.plataforma_device_id` se vier IMEI em vez do ID Softruck

3. Arquivos a ajustar
- `supabase/functions/popular-ids-softruck/index.ts`
  - transformar a função em reconciliador real, não apenas “ler relationship do device”.
  - para cada rastreador instalado:
    - buscar veículo local vinculado
    - resolver `vehicleId` por esta ordem:
      1. `rastreadores.plataforma_veiculo_id`
      2. `veiculos.softruck_vehicle_id`
      3. `softruck-api -> buscar-veiculo-placa`
      4. `softruck-api -> criar-veiculo`
    - resolver `deviceId` válido do rastreador
    - garantir associação `device <-> vehicle` via `associar-device-veiculo` com fallback `vincular-device-veiculo`
    - salvar os IDs encontrados/criados no banco
- `supabase/functions/sync-rastreadores/index.ts`
  - parar de depender só de `rastreadores.plataforma_veiculo_id`.
  - incluir no select os dados do veículo local (`id`, `placa`, `softruck_vehicle_id`).
  - usar `vehicleId = rast.plataforma_veiculo_id || rast.veiculo?.softruck_vehicle_id`.
  - se encontrar `softruck_vehicle_id` no veículo e faltar no rastreador, persistir no rastreador.
  - manter tracking apenas com IDs corretos da plataforma.
- `supabase/functions/rastreador-posicao/index.ts`
  - aplicar a mesma lógica de resolução/persistência para o mapa individual e atualização manual.
  - assim um rastreador corrigido manualmente já volta a pontuar sem esperar o cron.
- `supabase/functions/posicao-veiculo/index.ts`
  - alinhar com a implementação que já funciona em `rastreador-posicao`.
  - corrigir divergência de parser/resposta Softruck e base URL, para não existir um fluxo “bom” e outro “quebrado”.

4. Decisão de arquitetura
- Centralizar a resolução dos IDs Softruck em um helper compartilhado em `supabase/functions/_shared/...`.
- Isso evita repetir lógica em 3 funções diferentes e reduz novos desencontros.

5. Resultado esperado
- O batch de reconciliação preencherá os `vehicleId` faltantes usando o veículo já vinculado localmente.
- O cron `sync-rastreadores` voltará a inserir posições no `rastreador_posicoes`.
- O trigger já existente atualizará `ultima_comunicacao`, `ultima_posicao_lat` e `ultima_posicao_lng`.
- A UI de rastreadores passará a marcar online/offline com base em comunicação real, não por falta de ID.
- Depois disso, os que continuarem offline estarão realmente sem comunicação recente na Softruck.

6. Validação após implementar
- Confirmar aumento de `rastreadores.plataforma_veiculo_id` e `veiculos.softruck_vehicle_id`.
- Rodar o reconciliador em lote.
- Executar `sync-rastreadores` para Softruck e verificar inserção de posições.
- Validar na tela `/monitoramento/rastreadores` e no mapa que os rastreadores corrigidos aparecem online e com posição.
