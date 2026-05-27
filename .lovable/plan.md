
## Escopo confirmado

Só conserto da causa-raiz. Sem hook novo, sem aba de pendentes, sem refactor de UX, sem sweep periódico extra, sem mexer em card de validação / Rastreadores / cadastro de veículo.

Foco único: garantir que nova ativação **Softruck** e nova vinculação **Rede Veículos** **não travem** como QPW4H53 / RUM0H01.

## Diagnóstico do estado atual

**Softruck (`softruck-ativar-dispositivo/index.ts`)** — o conserto principal já existe:
- Passo **8.5** (linhas 658–696) faz o UPDATE canônico (`plataforma_device_id`, `plataforma_veiculo_id`, `softruck_chip_id`, `softruck_integration_status='SUCCESS'`, `status='instalado'`, `veiculos.softruck_vehicle_id`) **antes** do GPS.
- O passo 8.5 já enfileira em `softruck_gps_poll_queue` (tabela existe, worker `cron-softruck-gps-poll` existe).
- Mas o passo **8.6** (linhas 698–740) ainda faz tentativa síncrona de GPS dentro da edge — hoje com `MAX_TENTATIVAS=1` e `INTERVALO_MS=0`, então é só 1 chamada HTTP, mas ainda é tempo agarrado na resposta.
- O passo **9** (linhas 742–788) refaz o UPDATE inteiro depois do GPS — é redundante com o 8.5 e mantém a porta aberta para "se travar aqui, perdemos coisa". Conforme o RUM0H01/QPW4H53 originais.

**Rede Veículos (`rede-veiculos-vincular-cliente/index.ts`)** — não tem polling de GPS, mas tem dois problemas:
- O **passo 8** (UPDATE local, linhas 421–451) já vem **antes** do passo 8.1 (`ativarVeiculo`, linhas 453–489), e o 8.1 já está em try/catch não-bloqueante. ✅ Ordem está OK.
- **Faltam guardas de idempotência:** se a edge for chamada 2x para o mesmo IMEI/veículo, o segundo POST `/vincularClienteVeiculo/` é disparado de novo — risco de cliente/veículo/equipamento duplicado no lado da Rede.

## O conserto (mínimo)

### 1. Softruck — fechar a janela do GPS de vez

Em `supabase/functions/softruck-ativar-dispositivo/index.ts`:

- **Remover o passo 8.6 inteiro** (linhas 698–740 — laço síncrono de tracking) e **remover o passo 9** (linhas 742–788 — segundo UPDATE redundante).
- Posições GPS passam a ser **100% responsabilidade** do worker assíncrono (`cron-softruck-gps-poll` consumindo `softruck_gps_poll_queue`), que já está deployado.
- O `responseRaw` do log final (passo 13, linhas 820–830) passa a referenciar `{ softruckVehicleId, softruckDeviceId, softruckChipId, softruckUserId, gps_polling: 'async' }` (mesmo objeto que o 8.5 já grava).
- A resposta HTTP devolve `primeira_posicao: null` (campo mantido por compatibilidade, vira sempre null nesta edge).

Resultado: a edge devolve assim que o 8.5 grava. Nenhum caminho de código pode mais perder o UPDATE local por causa de GPS.

### 2. Softruck — verificação rápida de idempotência

Sem código novo. Só validar que o early-return existente (linhas 185–199) cobre re-chamada:
- Se `plataforma_device_id` E `plataforma_veiculo_id` já estiverem populados localmente, retorna `already_activated: true` sem tocar na Softruck.
- A criação de veículo/chip/device já tem `buscar → criar → on Already Exists, re-buscar`. ✅
- Vou adicionar UMA linha de log explicitando isso em PR (não muda comportamento).

### 3. Rede Veículos — early-return idempotente

Em `supabase/functions/rede-veiculos-vincular-cliente/index.ts`, logo após buscar `veiculo` (linha 176):

```ts
if (veiculo.rede_veiculos_veiculo_id && veiculo.rede_veiculos_cliente_id && rastreador.plataforma_device_id) {
  return new Response(JSON.stringify({
    success: true,
    rastreador_id: rastreador.id,
    rede_veiculos_cliente_id: veiculo.rede_veiculos_cliente_id,
    rede_veiculos_veiculo_id: veiculo.rede_veiculos_veiculo_id,
    rede_veiculos_equipamento_id: rastreador.plataforma_device_id,
    already_activated: true,
    mensagem: 'Já vinculado na Rede Veículos',
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

Resultado: rodar a edge 2x para o mesmo IMEI/veículo não dispara segundo `/vincularClienteVeiculo/`.

### 4. Rede Veículos — ordem do UPDATE já está OK

Sem mudança. O passo 8 (UPDATE local) já roda antes do 8.1 (`ativarVeiculo`), e o 8.1 já está envolvido em try/catch isolado. Não há padrão de travamento equivalente ao GPS da Softruck.

## O que NÃO entra (confirmando)

- ❌ Hook único de busca por placa
- ❌ Aba/tela de pendentes
- ❌ Sweep periódico novo (o `cron-softruck-gps-poll` já existe e fica)
- ❌ Estados intermediários complexos
- ❌ Card de validação, Rastreadores, cadastro de veículo
- ❌ Mexer em `softruck-buscar-dispositivo`, `rede-veiculos-buscar-dispositivo`, `useAtivarRastreador`, `useBuscarRastreadorPorImei`

## Critério de aceitação

1. Nova ativação Softruck em qualquer IMEI: `rastreadores.plataforma_device_id`, `plataforma_veiculo_id`, `softruck_integration_status='SUCCESS'`, `status='instalado'` e `veiculos.softruck_vehicle_id` ficam preenchidos **antes** do retorno HTTP. Travamento ou timeout em qualquer fase posterior do GPS não pode mais apagar isso (passos 8.6 e 9 deletados).
2. Rodar `softruck-ativar-dispositivo` 2x para o mesmo IMEI já vinculado: retorna `already_activated: true`, zero chamada externa.
3. Rodar `rede-veiculos-vincular-cliente` 2x para o mesmo IMEI já vinculado: retorna `already_activated: true`, zero POST em `/vincularClienteVeiculo/`.
4. Posições GPS continuam chegando via `cron-softruck-gps-poll` (worker assíncrono já em produção) — fora do caminho crítico da ativação.

## Arquivos tocados

- `supabase/functions/softruck-ativar-dispositivo/index.ts` — deletar passos 8.6 e 9; ajustar `responseRaw` do log de sucesso.
- `supabase/functions/rede-veiculos-vincular-cliente/index.ts` — adicionar early-return idempotente após buscar veículo.

Nenhum arquivo de frontend, nenhuma migration, nenhuma tabela nova.
