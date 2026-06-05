## Auditoria de mudanças por cron — Softruck & Rede Veículos (últimos 60 dias)

### Escopo

Apenas eventos cuja origem é **cron / reconciliação noturna**, excluindo o que aconteceu **durante** um processo (adesão, troca, substituição, ativação ao vivo no fluxo do usuário).

### Crons relevantes confirmados

| Job | Frequência | O que faz |
|---|---|---|
| `softruck-reconciliar-pending-10min` | a cada 10 min | Reprocessa ativações Softruck travadas em PENDING e detecta desvínculo remoto |
| `rede-veiculos-sync-cron-30min` | a cada 30 min | Sincroniza status de cliente/veículo na Rede |
| `cron-softruck-troca-retry` | a cada 5 min | Retry de vínculo Softruck em trocas de titularidade |

### Fontes de verdade (já mapeadas)

1. **`rastreadores_vinculo_historico`** — mudanças de vínculo no nosso DB feitas pelo cron (origem `auto_desvinculo_remoto_softruck`).
2. **`rastreadores_api_logs`** — TODAS as chamadas que o cron disparou contra Softruck/Rede (filtrar por `operacao` com prefixo `CRON_`, `RECONCILED_FROM_PENDING`, `AUTO_DESVINCULO_REMOTO`, e por reconciliação 30min da Rede).
3. **`rastreadores_sync_queue`** — itens que falharam ao vivo e foram concluídos por retry (`tentativas > 1`).

### Volume preliminar (60d)

- 2.711 reconciliações Softruck a partir de PENDING (sucesso) — **maior bloco**
- 1.061 execuções do job `CRON_RECONCILIAR_PENDING` 
- 42 desvínculos automáticos Softruck (rastreador sumiu remoto → desvinculamos local)
- 4 itens na fila finalizados após retry (3 sucesso, 1 falha permanente)
- 2.100 consultas de status na Rede (cron 30min) + 22 erros + 40 sem_resultado

### O que a auditoria vai entregar

CSV em `/mnt/documents/auditoria-cron-rastreadores-60d.csv` com **uma linha por evento cron** contendo:

- `data_hora` (BRT)
- `plataforma` (softruck / rede_veiculos)
- `job_cron` (qual cron disparou)
- `operacao` (ativar / desvincular / reconciliar / atualizar status)
- `rastreador_codigo` / `imei`
- `placa_anterior` → `placa_nova`
- `status_anterior` → `status_novo`
- `veiculo_id` / `associado_nome`
- `resultado` (sucesso / erro)
- `motivo` (ex.: "pending → success após N tentativas", "desvinculado remotamente na Softruck", "vínculo refeito após erro inicial")
- `tentativas_ate_concluir`
- `link_painel` (rota interna para o rastreador)

**Resumo executivo** (TXT/markdown) com:
- Totais por job, por plataforma, por tipo de modificação
- Top 10 rastreadores com mais intervenções cron
- Casos onde o cron **modificou** estado na Softruck/Rede (POST/PUT) vs. apenas **leu** (GET de reconciliação)
- Lista das 1 falha permanente + 22 erros de Rede que ainda merecem olhar humano

### Plano de execução (build mode)

1. Script SQL único que junta `rastreadores_api_logs` (filtrando operações de origem cron) + `rastreadores_vinculo_historico` (origem `auto_*`) + `rastreadores_sync_queue` (tentativas>1) com left-join em `rastreadores`, `veiculos`, `associados`.
2. Export para CSV via `psql COPY ... TO STDOUT WITH CSV HEADER` em `/mnt/documents/`.
3. Gerar `resumo-auditoria-cron-rastreadores-60d.md` com os agregados.
4. Entregar via `<presentation-artifact>` os dois arquivos.

### Fora de escopo (não confundir com cron)

- Vínculos feitos durante adesão / troca / substituição ao vivo (origem `trigger_db` no histórico — 369 eventos).
- Ações manuais de operador no painel (botão "Reprocessar Sincronização Softruck", etc.).
- Backfills disparados manualmente da tela `/configuracoes/integracoes/sga-hinova`.

### Decisão pendente

Confirma que você quer **CSV + resumo markdown** entregues como arquivos baixáveis? Se preferir uma tela dentro do sistema (`/configuracoes/integracoes/.../auditoria-cron`) com filtros e paginação, eu replanejo — leva mais tempo e mexe em UI, mas fica reutilizável.