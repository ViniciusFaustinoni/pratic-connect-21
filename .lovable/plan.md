## Diagnóstico final — confirmado com evidência

### O que encontrei na linha do tempo da Gleice

| # | Hora UTC | from → to | Origem | Observação |
|---|---|---|---|---|
| 1 | 14/05 11:23:55.474 | `pendente_vistoria` → `aguardando_instalacao` | `db:trigger` (associados) | Resultado da analista CAROLINE FLORIANO marcando `cadastro_aprovado=true`. **O Cadastro fez o trabalho dele.** |
| 2 | 14/05 11:24:03.239 | `aguardando_instalacao` → `ativo` | `db:trigger` (associados) | É o trigger `trg_log_associado_status_change` apenas **registrando** o UPDATE feito pela edge no passo 3 (não há trigger DB que promova para ativo) |
| 3 | 14/05 11:24:03.340 | `aguardando_instalacao` → `ativo` | `edge:ativar-associado<-edge:criar-instalacao-pos-pagamento` | **Payload pediu `aguardar_instalacao: true` — a edge ignorou** |
| 4 | 14/05 11:24:04.530 | `ativo` → `ativo` | `edge:ativar-associado<-edge:aprovar-proposta#idem-side-effects` | Re-confirmou estado já corrompido |

### Causa raiz (código)

A edge `supabase/functions/ativar-associado/index.ts` aplica `aguardar_instalacao` somente ao veículo (linha 304). Para associado, contrato e cotação, ela escreve `status='ativo'` incondicionalmente:

- Linha 247-258 — `UPDATE associados SET status='ativo'` ❌
- Linha 286-294 — `UPDATE contratos SET status='ativo'` ❌
- Linha 335-339 — `UPDATE cotacoes SET status_contratacao='ativo'` ❌
- Linhas 117-202 (caminho idempotente quando associado já está ativo) — também promove contrato/veículo/cotação sem checar `aguardar_instalacao` ❌

A edge chamadora `criar-instalacao-pos-pagamento` (linha 941) passa corretamente `aguardar_instalacao: true`. O bug está exclusivamente em `ativar-associado`.

### Vítimas identificadas (sintoma: assoc=`ativo` + contrato=`ativo` + veículo=`instalacao_pendente`)

Listei todos os contratos no banco com o mesmo padrão. Pelo menos **12+ associados** estão ativos sem instalação concluída, indo desde 22/04 até 14/05. Exemplos:

- GLEICE KELLE VIANA GONÇALVES — contrato CTR-20260513174646-7YE999
- LUIZ FERNANDO PINTO DE OLIVEIRA — CTR-20260512174145-0XABXJ
- MARCIO WELLINGTON BRITO SOUZA DA FONSECA — CTR-20260422152857-AOSYMV
- MATHEUS MARTINEZ DE OLIVEIRA — CTR-20260505215312-27ZJUJ
- RAFAEL NAPOLEÃO DO NASCIMENTO — CTR-20260422200810-SW0UEJ
- DOUGLAS DE PAULA PEREIRA, DANIEL FERREIRA DA SILVA, JUAN DOMINGOS CHAGAS, WENDEL LUIZ PEDRO SANTIAGO, ALEX DE OLIVEIRA SOBRINHO, JADIR DOS SANTOS OLIVEIRA, ALEXSANDRA RIBEIRO RAMOS… (lista completa será gerada na execução)

A maioria está com **cobertura desligada no veículo** (a parte mais crítica) — então não houve cobertura indevida ativa. O dano é **comercial/processual**: contratos figurando como ativos antes da instalação, pulando a fila de Aprovação do Monitoramento, possivelmente disparando comissão/cobrança/SGA antes da hora.

---

## Plano de correção — passo a passo

### Passo 1 — Corrigir a edge `ativar-associado`

Patch único em `supabase/functions/ativar-associado/index.ts`, sem alterar a assinatura nem quebrar chamadores existentes:

**1.a. Caminho normal (associado ainda não está `ativo`)**
- Quando `aguardar_instalacao === true`:
  - `associados.status` → manter em `aguardando_instalacao` (o CAS atual permite essa transição como no-op se já estiver lá; se vier de `pendente_vistoria/aprovado`, fazer UPDATE para `aguardando_instalacao`).
  - **Não** preencher `data_ativacao` no associado.
  - `contratos.status` → `aguardando_instalacao`, **não** preencher `data_ativacao`.
  - `cotacoes.status_contratacao` → `aguardando_instalacao` (não `ativo`).
  - Veículo: comportamento atual (já correto).
- Quando `aguardar_instalacao === false` (default): comportamento atual.
- O log fica com `to_status='aguardando_instalacao'` e payload `aguardar_instalacao: true` para auditoria.
- Resposta JSON ganha um campo extra: `aguardando_instalacao: true` (opcional, transparente para chamadores que ignoram campos novos).

**1.b. Caminho idempotente (associado já é `ativo`, novo veículo)**
- Quando `aguardar_instalacao === true`:
  - **Não** promover o novo contrato para `ativo` — escrever `aguardando_instalacao`.
  - Veículo: aplicar `instalacao_pendente` (já é o que o caminho idempotente NÃO faz hoje — hoje força `ativo`. Vou alinhar ao caminho normal usando `promoverStatus`).
  - Cotação: idem.

**1.c. Garantia de "promoção definitiva"**
- A promoção real para `ativo` continua acontecendo via:
  - `aprovar-monitoramento` / `aprovar-troca-monitoramento` (após Monitoramento aprovar a vistoria/instalação) chamando `ativar-associado` **sem** `aguardar_instalacao`.
  - `processar-vistoria` / `concluir-etapa-fotos-publica` quando aplicável.
- Vou validar que esses chamadores não passam `aguardar_instalacao: true` por engano. Se passarem, ajustar.

### Passo 2 — Migração de correção do estado dos afetados

Migration one-shot que:
1. Identifica todos os `(associado, contrato, veículo)` onde:
   - `associados.status='ativo'` AND `contratos.status='ativo'` AND `veiculos.status='instalacao_pendente'`
   - AND não existe `servicos` com `tipo='instalacao'` e `status='concluida'` para o contrato.
2. Para cada um:
   - `UPDATE associados SET status='aguardando_instalacao', data_ativacao=NULL`
   - `UPDATE contratos SET status='aguardando_instalacao', data_ativacao=NULL`
   - `UPDATE cotacoes SET status_contratacao='aguardando_instalacao'` (via `cotacao_id` do contrato)
   - Mantém `cadastro_aprovado=true`, `aprovado_em`, `aprovado_por` (foi feito de fato).
   - Insere linha em `ativacao_status_log` com `source='manual:fix-bug-aguardar-instalacao'` e payload com lista de side-effects.
3. **Não mexe** em veículos (já estão certos), nem em comissões nesta migration (item separado, ver passo 3).

A migration usa CTE para garantir atomicidade e gravar quem foi tocado.

### Passo 3 — Verificar e reverter comissões indevidas

O trigger `trigger_comissao_ao_ativar` em `contratos` calcula comissão na ativação. Para cada vítima, vou:
1. Consultar `comissoes_geradas` (ou nome equivalente) por `contrato_id`.
2. Se comissão foi gerada com `created_at` posterior à `data_ativacao` errada, marcar como `pendente_revalidacao` ou estornar — vou trazer a lista para você decidir antes de executar.
3. Após instalação concluir + aprovação Monitoramento, a ativação real chamará o trigger normalmente e gerará a comissão correta.

### Passo 4 — Verificar SGA

O contrato/associado ativado erradamente pode ter sido sincronizado com o Hinova. Pela memória `sga-hinova-sync-and-pre-check-v3` e pela regra Core "sistema NUNCA envia situação ATIVO", o pior cenário é o associado/veículo no SGA estar como PENDENTE (3) — o que está correto. Vou confirmar consultando `sga_sync_queue` para os afetados.

### Passo 5 — Auditoria no UI

Após a migration, esses contratos vão reaparecer na fila correta (Propostas Pendentes / aguardando instalação). Gleice, especificamente, voltará para a fila pré-instalação com a vistoria agendada para 15/05 — exatamente onde deveria estar.

### Passo 6 — Atualizar memória

Atualizar `mem://architecture/activation/single-source-activation` com a regra explícita: "`aguardar_instalacao=true` significa NÃO promover associado, contrato nem cotação para `ativo` — só veículo permanece em `instalacao_pendente`. A promoção definitiva sempre vem da aprovação do Monitoramento."

---

## Ordem de execução proposta

1. Patch da edge `ativar-associado` (passos 1.a, 1.b, 1.c) — não rompe nenhum chamador.
2. Validação rápida nos chamadores `aprovar-monitoramento` / `aprovar-troca-monitoramento` / `processar-vistoria` / `concluir-etapa-fotos-publica` para confirmar que **não** passam `aguardar_instalacao: true`.
3. Listagem completa de vítimas + comissões geradas indevidamente (consulta read-only, devolvo a tabela aqui).
4. Migration de reversão (após você aprovar a lista).
5. Atualização de memória.

---

## O que NÃO está envolvido

- **Setor de Cadastro**: trabalhou corretamente. A analista Caroline aprovou normalmente.
- **Triggers do banco**: nenhum trigger promove para `ativo`; o `db:trigger` no log #2 é só registro (`trg_log_associado_status_change`).
- **Edge `criar-instalacao-pos-pagamento`**: enviou o payload correto (`aguardar_instalacao: true`).
- **Veículos**: estão no estado certo (`instalacao_pendente`, coberturas corretas).

A culpa é única e exclusivamente da edge `ativar-associado` por ignorar o flag.

Posso executar os passos 1 e 2 imediatamente após sua aprovação. Os passos 3 e 4 dependem de você revisar a lista antes do rollback de massa.
