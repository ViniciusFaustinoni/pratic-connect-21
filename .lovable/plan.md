## Por que não voltou para a escolha do plano

A reversão anterior só mexeu em `solicitacoes_troca_titularidade` e zerou `plano_id` da cotação. Mas a tela pública decide a etapa pelo campo **`cotacao.status_contratacao`** (via `determinarEtapa`), e ele continua em `vistoria_agendada`. Além disso a cotação já tem `contrato_gerado_id` (contrato assinado no Autentique) e um agendamento de vistoria base ativo — por isso o link mostra "Em Análise / etapas avançadas" em vez de "Escolha o plano".

Para realmente voltar ao passo de escolha do plano, é preciso desfazer também esses artefatos a jusante.

## O que fazer

Migração SQL única, escopada à cotação `COT-20260513-192005877-360` (id `d411a54c-…`):

1. **Cotação** — voltar ao zero do funil:
   - `status_contratacao = 'aguardando'`
   - `plano_id = NULL`, `plano_escolhido_id = NULL`
   - `contrato_gerado_id = NULL`
   - `tipo_vistoria = NULL`

2. **Agendamento base** `51c14014-…`:
   - `status = 'cancelado'` + `cancelado_em = now()` + motivo "reset para teste de troca de titularidade".

3. **Contrato** `13893972-…` (atualmente `assinado`):
   - `status = 'cancelado'`, marcar `cancelado_em` e `motivo_cancelamento = 'reset para teste de troca de titularidade'`.
   - Não tocar no documento Autentique remoto (apenas marca interna; o link antigo fica órfão).

4. **Solicitação de troca** `52cc74c1-…`:
   - Já está em `cotacao_em_andamento` — só reconfirmar `aprovado_cadastro_em = NULL` e zerar `servico_vistoria_id` / `servico_manutencao_id` se houver.
   - Manter `termo_cancelamento_assinado_em` (preserva o termo já assinado).
   - Manter `veiculos.em_troca_titularidade = true` (a marca de troca em andamento permanece).

Após isso, ao reabrir o link da cotação, o stepper público começa em **Etapa 0 — Escolha de Plano** com o termo de cancelamento já assinado, exatamente como pedido.

## Confirmação

Quer que eu execute essa migração de reset agora? Vou tocar **somente** nesse `cotacao_id` / `contrato_id` / `agendamento_base_id` específicos.