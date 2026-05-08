## Diagnóstico

Analisando o código existente identifiquei **um bug que impede a Fila Plataformas de funcionar para Rede Veículos** e mapeei o estado real dos fluxos de desvínculo.

### Bug crítico — plataforma normalizada errada

Na implementação que acabamos de fazer, usei `'rede'` como rótulo, mas no banco e em **todas** as edge functions o valor canônico é `'rede_veiculos'` (4.242 rastreadores na base).

Impacto direto:
- `rastreadores_sync_queue.plataforma` tem CHECK constraint `IN ('softruck','rede')` → **vai recusar** qualquer item Rede.
- A view `rastreadores_pendentes_vinculo` filtra `IN ('softruck','rede')` → **não lista nenhum dos 4.242 rastreadores** Rede.
- A aba "Rede Veículos" do painel mostra zero.

Além disso, o worker chama `rede-veiculos-ativar-cliente-completo` com payload `{imei, veiculoId, associadoId, associadoEmail}`, mas essa edge espera **só `{associadoId, motivo, revincular}`** e processa todos os veículos do associado de uma vez. Para vincular um rastreador específico a função correta é `rede-veiculos-vincular-cliente` (que aceita `{imei, veiculoId, associadoId}`).

### Estado dos fluxos de desvínculo (já existentes no projeto)

| Direção | Softruck | Rede Veículos |
|---|---|---|
| Plataforma → Sistema | Webhook `DEVICES.DISASSOCIATED` zera vínculos + grava histórico (`softruck-webhook` linhas 395–443) | Cron `rede-veiculos-sync-cron-30min` chama `rede-veiculos-sincronizar-status`, que detecta 404/dispositivo nulo e zera vínculos (linhas 140–240) |
| Sistema → Plataforma | `concluir-retirada` chama `softruck-api operation=deactivate_device` | `concluir-retirada` chama `rede-veiculos-desvincular-cliente` |

Os caminhos existem, mas **nunca foram validados ponta-a-ponta** após o nosso refactor recente. Também não há validação de que outros fluxos (cancelamento, substituição, venda, status terminal) chamam o desvínculo da plataforma — hoje só `concluir-retirada` faz.

## Plano de correção raiz

### Etapa 1 — Corrigir o painel Fila Plataformas para Rede

Migração:
- Alterar CHECK de `rastreadores_sync_queue.plataforma` e `rastreadores_sync_health_checks.plataforma` para aceitar `'softruck'` e `'rede_veiculos'`.
- Recriar a view `rastreadores_pendentes_vinculo` filtrando `plataforma IN ('softruck','rede_veiculos')`.

Frontend:
- `useRastreadoresSyncQueue` e `PlataformasSyncPanel`: trocar tipo `'rede'` por `'rede_veiculos'` em todas as queries/labels (mantendo rótulo "Rede Veículos" na UI).

Edge `rastreadores-sync-worker`:
- No `reprocess` para `rede_veiculos`, em vez de `rede-veiculos-ativar-cliente-completo`, chamar **`rede-veiculos-vincular-cliente`** com `{imei, veiculoId: rast.veiculo_id, associadoId: rast.associado_id}`. Esta é a função correta para vincular **um** rastreador.
- No `health_check` para `rede_veiculos`, usar um endpoint leve real da API Rede (ex.: `rede-veiculos-obter-status-cliente` com um `clienteId` de teste, ou um ping seguindo o padrão Softruck `?ping=1`). Hoje passei `{ ping: true }` que a função não trata.

### Etapa 2 — Validar vínculo Rede ponta-a-ponta

1. Identificar um IMEI Rede que aparece em `rastreadores_pendentes_vinculo` (instalado, sem `plataforma_veiculo_id` ou `plataforma_user_id`).
2. Pelo painel, clicar **Sincronizar**, depois **Reprocessar**.
3. Validar que `rastreadores.plataforma_veiculo_id` e `plataforma_user_id` ficaram preenchidos e que a fila marcou `concluido`.
4. Conferir o registro em `rastreadores_api_logs` e `rastreadores_vinculo_historico`.

### Etapa 3 — Validar desvínculo Plataforma → Sistema

**Softruck (webhook):**
- Pegar um IMEI Softruck **de teste** com vínculo completo.
- Chamar `softruck-webhook` simulando payload `DEVICES.DISASSOCIATED` para esse rastreador.
- Validar que `rastreadores` ficou com `veiculo_id`, `associado_id`, `plataforma_veiculo_id`, `plataforma_user_id` zerados, status `'estoque'`, com entrada em `rastreadores_vinculo_historico` (`origem='webhook_softtruck_disassociated'`).
- Após validar, **religar** manualmente via Fila Plataformas ▸ Reprocessar.

**Rede Veículos (cron):**
- Identificar um veículo Rede vinculado e forçar uma resposta 404 (ou aguardar o cron das 30min).
- Disparar manualmente `rede-veiculos-sync-cron` e validar `rastreadores_vinculo_historico` com `origem='sync_rede_veiculos_desvinculo'`.
- Confirmar que o cron de 30min está agendado (já está: job `rede-veiculos-sync-cron-30min`).

### Etapa 4 — Validar desvínculo Sistema → Plataforma

**Softruck:**
- Em ambiente de teste, abrir uma retirada de rastreador concluída pelo `concluir-retirada` e verificar log `Resposta Softruck: success=true`.
- Confirmar pela API Softruck que o device foi desativado.

**Rede:**
- Mesmo teste com rastreador Rede → validar que `rede-veiculos-desvincular-cliente` retornou sucesso.

### Etapa 5 — Cobertura: garantir que TODO desvínculo local chama plataforma

Hoje só `concluir-retirada` dispara o desvínculo externo. Auditar e padronizar os demais caminhos que zeram `rastreadores.veiculo_id`:

- `useRetiradaRastreador` ✅ (vai por `concluir-retirada`).
- `useSubstituirEquipamento` — verificar.
- `useTransferirVeiculo` — verificar.
- `useVenderVeiculo` — verificar.
- Cancelamento de contrato (status terminal do veículo).
- Trigger SQL que zera `veiculo_id` quando veículo entra em status terminal.

Para cada caminho que **não** chama desvínculo da plataforma, criar item `falha` na `rastreadores_sync_queue` (operação `desvincular`) ou chamar diretamente a edge correta. Adicionar uma operação `desvincular` ao worker:
- Softruck: `softruck-api operation=deactivate_device`.
- Rede: `rede-veiculos-desvincular-cliente`.

### Etapa 6 — Observabilidade no painel

Na aba "Logs" da Fila Plataformas, separar por operação (`vincular` vs `desvincular`) para que o operador veja os dois sentidos. Os dados já existem em `rastreadores_api_logs.operacao` — só ajustar a coluna na UI.

## Entregáveis

1. Migração ajustando CHECK + view para `'rede_veiculos'`.
2. Patch em `useRastreadoresSyncQueue.ts` e `PlataformasSyncPanel.tsx` (rótulo da plataforma).
3. Patch em `rastreadores-sync-worker/index.ts` (rota Rede correta + health check Rede + nova operação `desvincular`).
4. Roteiro de testes executado (5 cenários acima) com prints/registros de evidência.
5. Auditoria + correção dos hooks/triggers que zeram `veiculo_id` sem chamar plataforma.
6. Atualizar memória `mem://logic/operations/softtruck-desvinculo-bidirecional` se algum gap for descoberto.

## Fora de escopo (a confirmar)

- Implementar cron de drenagem automática da fila (hoje só reprocessamento manual). Pergunto antes de incluir.
- Criar webhook do lado da Rede Veículos (a Rede não envia webhook hoje — confiamos no cron 30min).

Posso seguir com este plano? Se quiser, separo em duas entregas: **(A)** corrigir Rede + validações de vínculo/desvínculo; **(B)** auditoria de cobertura (Etapa 5).
