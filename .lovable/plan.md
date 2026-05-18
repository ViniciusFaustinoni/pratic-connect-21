# Reprocessamento — KOA4D63 (Honda CG 150 / JUAN DOMINGOS CHAGAS)

## Contexto atual confirmado no banco

- **Veículo** `23a2bfb7…` — `instalacao_pendente` (moto, FIPE R$ 11.053 ≥ 9k → exige rastreador)
- **Contrato** `1dca5199…` — `assinado`, `cadastro_aprovado=true`
- **Cotação** `9b199c6f…` — `status_contratacao=pagamento_ok`, autovistoria já materializada
- **Instalação antiga** `6f6cbb8f…` (24/04) — `nao_compareceu`, sem rastreador
- **Serviço antigo** `285b49a8…` (instalacao 24/04) — `nao_compareceu`
- **Serviço novo** `4ae1c7ab…` (`vistoria_entrada`, agendada hoje 18/05) — **único artefato vivo do reagendamento; não existe `instalacoes` correspondente**
- **Rastreador** `0e3e192e…` (IMEI 868018075119845, Softruck) — em `estoque`, sem vínculo

A instalação física aconteceu hoje no campo, mas nada foi escrito porque o fluxo do prestador não fechou pelo link / app. Precisamos materializar o resultado e empurrar para a fila canônica de aprovação.

## Estratégia

Seguir a sequência canônica (memórias `single-source-activation`, `veiculo-novo-aguarda-instalacao`, `sincronizacao-status-pos-instalacao`), sem atalhos diretos para `status='ativo'`. Toda promoção a ativo continua exclusiva da edge `ativar-associado`, acionada manualmente na fila do Monitoramento após o reprocessamento.

### Etapa 1 — Vincular rastreador ao veículo

Atualizar `rastreadores 0e3e192e…`:
- `veiculo_id = 23a2bfb7…`
- `associado_id = 72ca27f8…`
- `status = 'instalado'`
- `local_instalacao`, `descricao_instalacao` (texto padrão "Reprocessamento manual 18/05 — instalação confirmada em campo")

Disparar `softruck-ativar-dispositivo` para garantir vínculo do device no Softruck (idempotente; se já estiver, retorna ok). Memória `softruck-placa-zero-km` não se aplica (placa real).

### Etapa 2 — Materializar a instalação concluída

Como o reagendamento criou só `servicos.vistoria_entrada` (sem `instalacoes`), criar **nova linha** em `instalacoes` espelhando o serviço 4ae1c7ab e o contrato:
- `contrato_id = 1dca5199…`
- `veiculo_id = 23a2bfb7…`
- `rastreador_id = 0e3e192e…`
- `data_agendada = 2026-05-18`
- `status = 'concluida'`
- `iniciada_em = now()`, `concluida_em = now()`
- `concluida_por = NULL` (reprocessamento administrativo, registrar em `dados_extras`/observação)

Fechar o serviço `4ae1c7ab` em paralelo:
- `status = 'concluida'`
- `rastreador_id = 0e3e192e…`
- `iniciada_em`, `concluida_em = now()`

Memória `vistoria-entrada-equivale-instalacao` autoriza tratar os dois como o mesmo evento. Guard `trg_guard_instalacao_concluida_exige_rastreador` passa porque o rastreador já está vinculado.

### Etapa 3 — Religar cobertura e entrar na fila

Triggers automáticos esperados após Etapa 2:
- `fn_reativar_cobertura_pos_instalacao` → reativa coberturas suspensas, promove veículo `instalacao_pendente → aguardando_aprovacao_monitoramento`
- `trg_sync_agendamento_base_on_servico_terminal` → fecha agendamentos pendentes do serviço
- O caso passa a aparecer em **Monitoramento › Aprovações › Aprovação de Associados**

Validar via SELECT que o veículo saiu de `instalacao_pendente` e o contrato está pronto para o passo final.

### Etapa 4 — Aprovação Monitoramento + ativação canônica

Não fazer auto-ativação. Devolver o caso para a fila e ativar pelo caminho único:
- Operador clica "Aprovar" na fila → invoca `ativar-associado` com `instalacao_id` da nova linha, rastreador vinculado, `actor` = usuário logado
- `ativar-associado` faz lock + CAS, valida guard `trg_guard_veiculo_ativo_exige_rastreador`, promove contrato/veículo para `ativo`, grava em `ativacao_status_log`
- SGA Hinova: cadastro força PENDENTE; promoção a ATIVO é manual no painel SGA (memórias `sga-hinova` aplicam)

## Entregáveis deste reprocessamento

1. Migration **idempotente** com `UPDATE rastreadores` + `INSERT instalacoes` + `UPDATE servicos`, envelopados em transação. Guards de DB são respeitados; nada é inserido se algum invariante falhar.
2. Chamada manual `softruck-ativar-dispositivo` (curl/edge invoke) após a migration.
3. SELECT de verificação confirmando: rastreador `instalado` + veículo fora de `instalacao_pendente` + caso visível na fila do Monitoramento.
4. Instrução para o operador concluir a ativação clicando em **Aprovar** na fila — para garantir o log de quem ativou e respeitar o `single-source-activation`.

## Riscos e mitigação

- **Cron `reconciliar-contratos-pos-monitoramento`** (a cada 15 min) pode tentar promover sozinho — ok, ele só destrava casos parados em `assinado`, e o guard exige rastreador, que já estará vinculado.
- **Trigger reverter ativo→aguardando** (visto no OOV8C87) — não ocorre aqui porque o rastreador estará linkado antes de qualquer promoção.
- **Softruck offline / IMEI já em outro veículo** — `softruck-ativar-dispositivo` retorna erro; nesse caso aborta a Etapa 2 (não materializa instalação) para não gerar inconsistência.
- **Cobertura 48h** — religada automaticamente; sem ação manual.

## Confirmações pedidas antes de executar

1. Confirmar que a instalação física foi **hoje 18/05** (data a usar em `concluida_em`/`iniciada_em`).
2. Confirmar local da instalação (oficina/endereço) para gravar em `rastreadores.local_instalacao`.
3. Confirmar que o operador (você ou outro usuário) fará o clique final de **Aprovar** na fila do Monitoramento, mantendo `ativar-associado` como única porta de entrada para `ativo`.
