## Problema
Na Troca de Titularidade, a solicitação do novo titular pula a fila do Cadastro e cai direto em Monitoramento. Acontece porque a edge `vincular-cotacao-troca` auto-aprova o Cadastro quando o termo de cancelamento do antigo titular está assinado.

## Objetivo
Após o novo titular concluir o link público (plano + documentos + termo + pagamento + vistoria/agendamento), a solicitação **sempre** entra em `aguardando_cadastro`. Só após aprovação manual do Cadastro segue para `aguardando_monitoramento`. Após aprovação manual do Monitoramento, ativa o associado. Mesmo fluxo de uma cotação nova.

## Mudanças

### 1. `supabase/functions/vincular-cotacao-troca/index.ts`
- Remover o bloco que seta `status='liberada_para_assinatura'` + `aprovado_cadastro_em`.
- Apenas vincular `cotacao_id` à solicitação e manter `status='aguardando_cadastro'` (ou avançar de `cotacao_em_andamento` para `aguardando_cadastro` somente após o link público concluir — ver passo 2).
- Manter `runPosCadastroBackgroundFireAndForget` (snapshot SGA + atribuição de vendedor) — roda no momento da vinculação, não depende mais de aprovação.
- Resposta passa a indicar `cadastro_auto_aprovado: false`.

### 2. Finalização do link público (novo titular)
Identificar o ponto onde o novo titular conclui a última etapa do link público (assinatura do termo de filiação + pagamento + vistoria agendada). Nesse momento (provavelmente em `aprovar-proposta` ou edge equivalente para troca), garantir transição: 
- `solicitacoes_troca_titularidade.status` → `aguardando_cadastro`
- A solicitação aparece em `/cadastro/aprovacoes-troca` (fila já existente).

### 3. `supabase/functions/aprovar-troca-cadastro/index.ts`
- Já existe e está correto: aceita `aguardando_cadastro` → avança para `liberada_para_assinatura`. Vai virar o caminho normal (não mais "fallback legado").
- Garantir que o background job `runPosCadastroBackgroundFireAndForget` rode aqui também (idempotente — sem efeito se já rodou na vinculação).

### 4. Trigger `tg_troca_vistoria_concluida`
- Mantém comportamento: ao concluir vistoria, promove `aguardando_vistoria` → `liberada_para_assinatura` (ou `aguardando_monitoramento` conforme memória atual). Sem mudança.

### 5. UI — `TelaAnaliseTrocaTitularidade.tsx`
- Já cobre `aguardando_cadastro` ("Em análise pelo Cadastro"). Sem mudança visual.

### 6. Solicitação atual do Marcus Vinicius
- Migração `UPDATE solicitacoes_troca_titularidade SET status='aguardando_cadastro', aprovado_cadastro_em=NULL, aprovado_cadastro_por=NULL, observacao_cadastro=NULL WHERE associado_antigo_id = (select id from associados where nome ilike 'MARCUS VINICIUS FAUSTINONI%') AND status IN ('liberada_para_assinatura','aguardando_monitoramento') AND efetivada_em IS NULL` — para devolvê-la à fila do Cadastro.
- Fechar serviço de monitoramento criado indevidamente (se houver) — verificar antes de aplicar.

### 7. Memória
- Atualizar `mem://logic/operations/troca-titularidade-cadastro-auto` invertendo a regra: "Cadastro da Troca SEMPRE passa por aprovação manual após o novo titular concluir o link público; `vincular-cotacao-troca` apenas vincula a cotação, não aprova".
- Atualizar Core do `mem://index.md` se necessário.

## Fora de escopo
- Mudanças na fila do Monitoramento, no `aprovar-troca-monitoramento` e no `efetivar-troca-titularidade` (continuam como estão).
- Mudanças no fluxo do antigo titular (assinatura do termo de cancelamento).

## Verificação
1. Criar solicitação de teste; assinar termo do antigo titular.
2. Novo titular completa link público até vistoria/agendamento.
3. Confirmar status = `aguardando_cadastro` e aparece em `/cadastro/aprovacoes-troca` (não em `/monitoramento/aprovacoes-troca`).
4. Cadastro aprova → status = `liberada_para_assinatura`/`aguardando_monitoramento` conforme trigger.
5. Monitoramento aprova → ativa.
