

## Sincronização financeira SGA — diagnóstico e correção da população

### Fotografia atual do banco

| Métrica | Valor |
|---|---|
| Veículos elegíveis (base antiga, `origem_cadastro='api_externa'`) | **9.623** |
| ↳ com `codigo_hinova` mapeado | 4.624 |
| ↳ sem `codigo_hinova` (mas com placa + CPF) | **4.999** |
| Jobs `pendente` | **13.610** |
| Jobs `erro` | 260 (todos `401 — restrição de horário`) |
| Jobs `sem_historico_hinova` | 2.852 |
| Jobs `concluido` | 10 (e **importaram 0 boletos cada**) |
| **Cobranças SGA na tabela `cobrancas`** | **0** ❌ |

Em produção há 9.623 veículos da base antiga e **nenhum** boleto SGA salvo localmente. A régua de cobrança não tem o que enviar para esses associados. Os jobs estão rodando, mas falhando silenciosamente.

### Causas raízes (4 bugs reais)

1. **Erro 401 mascarado como "placa não encontrada"** (`_shared/hinova-client.ts` linhas 145–172).
   `buscarVeiculoPorPlaca` trata HTTP 401 / 502 / 406 igual a 404 e devolve `null`. O orquestrador grava `"Placa não encontrada (http=401)"` em 2.687 jobs. **Não é placa errada — é token expirado / sessão recusada / Hinova fora do ar**.

2. **Restrição de horário no usuário Hinova SGA.**
   260 jobs falharam com `"Usuário com restrição de horário"`. O cron diário roda às **05:00 UTC = 02:00 BRT** — fora do horário comercial liberado para o usuário no painel SGA. **Solução do lado deles** (liberar 24h ou ajustar janela), mas o sistema precisa **detectar e adiar** em vez de marcar `erro` permanente.

3. **Reconciliação por CPF não dispara quando codigo_hinova já existe.**
   Em `sga-sync-financeiro-veiculo` linhas 137–193, se `codigo_associado` já está preenchido (mesmo desatualizado), nunca tenta o fallback CPF. E a função `listarBoletosVeiculo` retorna `[]` em **qualquer** erro HTTP — sem distinguir "associado sem boletos" de "401 / 5xx". Resultado: 10 jobs marcados como `concluido` com 0 boletos quando provavelmente houve 401 silencioso.

4. **Throughput insuficiente.** Cron processa no máximo 1.200/dia. Para 13.610 jobs pendentes + 4.999 ainda sem mapeamento = **~18.600 tentativas necessárias → 16 dias** mesmo com 100% de sucesso.

### Mudanças

**A. `supabase/functions/_shared/hinova-client.ts` — propagar erros de auth e rede**

- `buscarVeiculoPorPlaca`: separar 404 (não encontrado) de 401/403/5xx. Lançar `HinovaTransientError` para 401/5xx (com `httpStatus`), retornar `null` só em 404 real.
- `listarBoletosVeiculo`: idem — só devolve `[]` em 200 com array vazio. Em 401/5xx, lança `HinovaTransientError`. Em 404, lança `HinovaNotFoundError`.
- `buscarSituacaoFinanceiraVeiculo`: idem.
- Detectar a string `"restri" + "hor"` no body de auth/listagem e marcar `error.transient = true, error.reason = 'janela_horaria'`.

**B. `supabase/functions/sga-sync-financeiro-veiculo/index.ts` — política de retry e fallback CPF sempre**

- **Sempre** tentar CPF como segunda fonte de `codigo_associado` quando a primeira chamada de boletos retornar vazio/erro, mesmo se já houver `codigo_hinova` (hoje só tenta se `!codigoAssociado`). Atualiza `associados.codigo_hinova` se divergir.
- Tratar exceções `HinovaTransientError`:
  - Marcar job como `pendente_retry` (novo status — abaixo).
  - Gravar `proximo_retry_em = now() + interval` calculado: 30min para 5xx, **next 09:00 BRT** para `janela_horaria`.
  - Não consumir `tentativas` do contador de erro permanente.
- `HinovaNotFoundError` real (404) → marca `sem_historico_hinova` (igual hoje).
- Após upsert dos boletos, gravar **resumo no veículo** (`total_aberto_sga`, `total_vencido_sga`, `situacao_financeira_sga`) — já existe, manter.

**C. Migration mínima**

- Adicionar status `pendente_retry` ao enum `sga_sync_financeiro_jobs.status` (se for enum) ou apenas valor textual permitido (já é texto livre — só ajustar filtros).
- Adicionar coluna `proximo_retry_em timestamptz null` em `sga_sync_financeiro_jobs`.
- Índice `idx_jobs_pendente_retry on sga_sync_financeiro_jobs(proximo_retry_em) where status='pendente_retry'`.

**D. `supabase/functions/sga-backfill-financeiro/index.ts` — fila incluir retries vencidos**

- Em `acao=processar`, além de `status='pendente'`, também pegar `status='pendente_retry' and proximo_retry_em <= now()`.
- Em `acao=enfileirar`, **também enfileirar veículos sem `codigo_hinova` mas com placa+CPF** (hoje exclui via `.not('codigo_hinova','is',null)`). A função sync já reconcilia via placa/CPF — basta dar a chance.
- Aumentar `batch_size` default no cron de 20 → 50 e ciclos de 60 → 80. Com 50ms entre chamadas (limite Hinova razoável), processa ~4.000/execução.

**E. `supabase/functions/cron-sga-sync-financeiro-diario/index.ts` — janela segura + escalonamento**

- Mover schedule do cron de `0 5 * * *` (02h BRT, fora da janela horária) para `0 12 * * *` (09h BRT — horário comercial garantido).
- Adicionar segundo cron `0 12-20/2 * * *` (a cada 2h entre 09h–17h BRT) que só roda `acao=processar` para drenar a fila acumulada nas primeiras semanas.

**F. UI — `src/components/cadastro/SgaBackfillFinanceiroDialog.tsx` (e badge no menu Cobranças)**

- Mostrar nova métrica: `pendente_retry` + tooltip explicando o motivo predominante (janela horária / 5xx).
- Card de erros agrupados por causa: já tem `ultimo_erro` na tabela — agregar top-5.
- Botão **"Reagendar erros para próxima janela"** que move `status='erro' and ultimo_erro ilike '%horario%'` para `pendente_retry` com `proximo_retry_em = next 09:00 BRT`.
- Botão **"Forçar sync agora (top 100 vencidos)"** para validação após o fix.

### O que NÃO muda

- Endpoints Hinova consumidos (`/buscar/situacao-financeira-veiculo`, `/listar/boleto-associado-veiculo`, `/veiculo/consultar/placa`, `/associado/buscar/{cpf}/cpf`) — todos já estão corretos conforme [doc oficial v2](https://api.hinova.com.br/api/sga/v2/doc/).
- Tabela `cobrancas` schema — campos `linha_digitavel`, `codigo_barras`, `boleto_url`, `nosso_numero` já existem.
- Régua de cobrança (`executar-regua-cobranca`) — já lê de `cobrancas` com `origem='sga_hinova'` (implementado em iteração anterior). Vai começar a ter dados assim que o backfill rodar.
- Veículos da base nova (`origem_cadastro='interno'`) — continuam fora do escopo (suas cobranças nascem locais via Asaas).

### Ações operacionais paralelas (do lado do usuário, fora do código)

> **Pré-requisito crítico:** o usuário Hinova/SGA configurado em `integracoes_credenciais` precisa ter a **restrição de horário removida** no painel SGA (ou janela liberada das 06h às 22h BRT). Sem isso, o cron das 09h ainda funciona, mas resyncs sob demanda fora dessa janela vão ficar em `pendente_retry`. Vou documentar isso na UI do dialog.

### Validação (após implementação)

1. Login `admin@teste.com / 123456789` → `Cadastro → Backfill SGA`.
2. Clicar **"Reagendar erros"** → confirmar que 260 + 2.687 jobs viram `pendente_retry`.
3. Disparar manualmente `cron-sga-sync-financeiro-diario` → conferir nos logs `boletos_importados > 0` em pelo menos 80% dos jobs concluídos.
4. Query `select count(*) from cobrancas where origem='sga_hinova'` → deve passar de 0 para milhares.
5. Abrir `/cobranca/regua` → o card de "Cobranças bloqueadas por falta de SGA" deve esvaziar nos próximos disparos.
6. Screenshot do dialog populado + count de cobranças importadas.

### Riscos

- **Rate limit Hinova:** 4.000 chamadas/execução em rajada pode estourar limite não documentado. Mitigação: `delay_ms=100` e exponential backoff em 429. O `HinovaTransientError` já cobre esse caso.
- **Cobranças duplicadas:** já há `onConflict: 'nosso_numero'` no upsert — idempotente.
- **Liberação da janela horária do usuário SGA depende do parceiro.** Se demorar, o cron diário ainda roda às 09h dentro da janela atual; processo só fica lento, mas não trava.
- **4.999 veículos sem `codigo_hinova`:** a reconciliação por placa+CPF tem ~70% de sucesso histórico (visto em `sga-hinova-sync`). Os 30% restantes (cadastros divergentes na Hinova) ficam em `sem_historico_hinova` para revisão manual — mesma política de hoje.

