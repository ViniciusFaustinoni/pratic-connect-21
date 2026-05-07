## Diagnóstico atual

**Tabela `softruck_eventos`** tem só 2 registros (29/01/2026): 1 `DEVICES.ASSOCIATED` + 1 `DEVICES.DISASSOCIATED`. Nada chegou desde então. Isso significa que **o webhook nem está sendo disparado pela Softtruck** — não é o handler que está travando, é a entrega que não vem.

**Webhook não tem validação de assinatura** (só registra IP/headers). Então qualquer requisição válida seria gravada — confirma que o problema é upstream (config do painel Softtruck, IP bloqueado, ou URL antiga).

**Rede Veículos** não tem webhook. A função `rede-veiculos-sincronizar-status` hoje só compara `ativo/inativo` e nunca olha se o vínculo dispositivo↔veículo ainda existe na plataforma.

**Histórico**: tabela `rastreadores_vinculo_historico` já existe (campos `veiculo_id_anterior/novo`, `status_anterior/novo`, `origem`, `contexto`). Vamos usá-la.

---

## Mudanças

### 1. `softruck-webhook` — handler `handleDeviceDisassociated` (auto-desvincular)

Mantém alerta crítico + notificação. Adiciona, quando o rastreador está vinculado a um veículo no nosso sistema:

- Captura `veiculo_id_anterior`, `placa_anterior`, `status_anterior` do rastreador
- Atualiza `rastreadores`: `veiculo_id=null`, `associado_id=null`, `plataforma_veiculo_id=null`, `status='estoque'`, `bloqueado=false`, `local_instalacao=null`, `descricao_instalacao=null`
- Insere em `rastreadores_vinculo_historico` com `origem='webhook_softtruck_disassociated'`, contexto com payload original
- Atualiza alerta gerado com flag `auto_desvinculado=true` no `dados_extras`

### 2. `rede-veiculos-sincronizar-status` — detectar divergência de vínculo

Hoje só compara status. Vai passar a verificar se o veículo ainda está associado ao dispositivo na Rede:

- Para cada veículo com `rede_veiculos_veiculo_id`, consultar endpoint da Rede que retorna o dispositivo vinculado (já usamos `/veiculos/{id}/posicao/`; se o response não retornar `dispositivo`/`equipamento` ou retornar 404, considerar desvinculado)
- Se desvinculado na plataforma E ainda vinculado no nosso lado:
  - Mesmo tratamento da Softtruck: zera vínculos no `rastreadores`, status `estoque`
  - Cria alerta crítico (`tipo='desinstalacao'`, `severidade='critica'`, `titulo='Dispositivo desvinculado na Rede Veículos'`)
  - Histórico em `rastreadores_vinculo_historico` com `origem='sync_rede_veiculos_desvinculo'`
  - Dispara `disparar-notificacao`
- Comportamento controlado por flag `forcarAtualizacao` apenas para a parte de status; **desvínculo de vínculo dispara sempre** (é evento de auditoria, não opcional)

### 3. Cron de sincronização Rede Veículos

A `rede-veiculos-sincronizar-status` hoje precisa ser chamada por associado. Para cobrir o caso "desvinculou na Rede e ninguém abriu o associado", vamos adicionar um cron 30 min que itera nos associados ativos com rastreador Rede e dispara a sync. Já existe padrão de cron 15min (`fn_reconciliar_status_pos_instalacao`). Cria o cron via migration usando `pg_cron` + edge function wrapper `rede-veiculos-sync-cron` (lê associados ativos com `rede_veiculos_veiculo_id`, invoca a sync para cada um em lote de 50).

### 4. Investigação webhook Softtruck (paralelo, mas concreto)

Não dá pra "perguntar à Softtruck" daqui. Os passos concretos:

a) **Adicionar logging mais robusto** no `softruck-webhook`: logar todo header recebido, IP, e gravar até requisições inválidas em uma tabela `softruck_webhook_raw_log` (rotativa, últimos 7 dias). Hoje, se a Softtruck mandar payload com formato diferente, o `req.json()` falha e a gente perde rastro.

b) **Endpoint de health check** `GET /softruck-webhook?ping=1` que retorna `200 ok` para validar do lado deles que a URL está acessível.

c) **Comparar com a config esperada**: a URL pública é `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/softruck-webhook`. Confirmar com o time/painel Softtruck se essa URL está cadastrada e os eventos `DEVICES.*` estão habilitados — isso é ação no painel deles (te aviso para fazer/confirmar lá).

### 5. Atualizar memórias

- `mem://logic/operations/rastreador-vinculo-preservacao`: adicionar exceção "desassociação confirmada via webhook DEVICES.DISASSOCIATED da Softtruck OU divergência detectada na sync da Rede Veículos também zera vínculo automaticamente, registrando origem em `rastreadores_vinculo_historico`"
- `mem://logic/operations/softruck-desvinculo-usuario-veiculo`: refletir que agora o webhook auto-desvincula (não fica só em alerta)
- Nova memória `mem://logic/operations/rede-veiculos-desvinculo-via-sync`: regra do desvínculo via sincronização

---

## Salvaguardas

- Auto-desvínculo SEMPRE acompanha alerta crítico aberto + notificação (auditoria preservada)
- Histórico em `rastreadores_vinculo_historico` permite reverter manualmente se for desvínculo indevido
- Webhook Softtruck continua sem validação de assinatura (não temos secret), mas logging amplo permite forense
- Sync da Rede só desvincula quando a API responder com confiança (404 ou ausência explícita do campo dispositivo); falhas de rede/HTTP 5xx **não** disparam desvínculo

## Arquivos afetados

- `supabase/functions/softruck-webhook/index.ts` — auto-desvincular + logging ampliado + endpoint ping
- `supabase/functions/rede-veiculos-sincronizar-status/index.ts` — detecção de desvínculo
- `supabase/functions/rede-veiculos-sync-cron/index.ts` — novo (cron wrapper)
- Migration: `pg_cron` schedule 30min para o wrapper acima; tabela opcional `softruck_webhook_raw_log` (rotativa)
- 3 memórias atualizadas/criadas
