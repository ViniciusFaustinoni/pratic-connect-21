# Reprocessamento — LMF8I79 (Fiat Siena Tetrafuel / contrato 8455c419…)

## Contexto confirmado no banco

- **Veículo** `34051e8c…` — `instalacao_pendente` (carro, FIPE **R$ 31.935 ≥ 30k → exige rastreador**)
- **Contrato** `8455c419…` — `assinado`, `cadastro_aprovado=true`, `cobertura_suspensa=false`
- **Cotação** `306dd82b…`
- **Instalação antiga** `42f3ea62…` (28/04) — `nao_compareceu`, sem rastreador
- **Serviço antigo** `ce71a651…` (instalacao 28/04) — `nao_compareceu`
- **Reagendamento atual**: **não existe** registro vivo em `instalacoes`/`servicos` (apenas o histórico de 28/04). O técnico instalou hoje sem materialização prévia.
- **Rastreador 865209074423352** (Softruck): não existia no nosso DB — **acabou de ser importado** via `softruck-buscar-dispositivo` → `6845fe77-8875-429a-bd5f-eec0539d6344`, status `estoque`, sem vínculo.

## Estratégia (idêntica ao reprocessamento do KOA4D63)

Manter o histórico do `nao_compareceu` intacto e materializar a instalação de hoje numa nova linha + serviço, depois empurrar para a fila canônica do Monitoramento.

### Etapa 1 — Vincular rastreador

`UPDATE rastreadores 6845fe77…`:
- `veiculo_id = 34051e8c…`
- `associado_id = 7840efc0…`
- `status = 'instalado'`
- `dados_extras += { reprocessamento_manual: { em, motivo, placa, contrato_id } }`

Guard: aborta se já estiver em outro veículo.

### Etapa 2 — Materializar instalação concluída de hoje

`INSERT INTO instalacoes`:
- `contrato_id`, `cotacao_id`, `veiculo_id`, `associado_id`, `rastreador_id`, `imei_rastreador='865209074423352'`
- `data_agendada = CURRENT_DATE`, `periodo = 'tarde'`
- `status = 'concluida'`, `iniciada_em = concluida_em = now()`
- `historico_datas = '[]'::jsonb`, `dispensa_rastreador = false`
- `observacoes` = "Reprocessamento manual 18/05/2026 — instalação física confirmada com rastreador Softruck IMEI 865209074423352."

`INSERT INTO servicos` (vistoria_entrada já concluida, idêntico ao padrão do prestador):
- `tipo='vistoria_entrada'`, `status='concluida'`, `modalidade='presencial'`, `local_vistoria='cliente'`, `periodo='tarde'`
- `rastreador_id`, `imei_rastreador`, `iniciada_em = concluida_em = now()`
- `instalacao_origem_id` = id da instalação criada na etapa anterior

Guard de DB `trg_guard_instalacao_concluida_exige_rastreador` passa porque o rastreador já está vinculado.

### Etapa 3 — Acionar Softruck

Chamar `softruck-ativar-dispositivo` com `{imei: '865209074423352', veiculoId, associadoId}` para garantir vínculo device↔veículo na Softruck (idempotente).

### Etapa 4 — Aprovação manual no Monitoramento

Não auto-ativar. Veículo continuará `instalacao_pendente` (cobertura nunca foi suspensa). O caso passa a aparecer em **Monitoramento › Aprovações › Aprovação de Associados** pelo serviço/instalação concluídos hoje. Operador clica **Aprovar** → `ativar-associado` promove para `ativo` (lock + CAS + log + guard rastreador-físico).

## Riscos e validação

- **Duplicação na fila** — não há autovistoria nem outra vistoria pendente, então só aparece este caso.
- **Cron `reconciliar-contratos-pos-monitoramento`** — pode tentar promover; guard `trg_guard_veiculo_ativo_exige_rastreador` exige rastreador, que já estará vinculado. Sem risco.
- **Softruck offline / IMEI em outro cliente** — `softruck-ativar-dispositivo` retorna erro; rollback manual se necessário. Conforme `softruck-buscar-dispositivo`, o IMEI está livre no Softruck (sem cliente/veículo vinculado lá).

## Confirmação que peço

A instalação física foi de fato **hoje 18/05/2026** com este IMEI? Se sim, executo as 3 etapas (UPDATE rastreador + INSERT instalação + serviço + chamada softruck-ativar) e te entrego para clicar Aprovar na fila.
