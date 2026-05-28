## Diagnóstico

Cotação `COT-20260528-142801654-756` (id `45d67b5d…`) tem `tipo_entrada='troca_titularidade'` e `veiculo_placa=SRZ2E82`, mas não existe **nenhuma** linha em `solicitacoes_troca_titularidade` apontando para ela (validado por query).

`useOutrosProcessos` faz `solicitacoes_troca_titularidade.in('cotacao_id', cotacaoIds)` → retorna vazio → `associadoAntigo = null` → `associado_antigo_email = null` → o `TrocaTimelineDrawer` mostra **"Associado antigo sem e-mail"**.

Mas o dono real do SRZ2E82 é **FERNANDO BENTO DE ALMEIDA** (`0c43955a…`) com email `fernandobentoa68@gmail.com`. O email existe — o hook é que ignora.

**Investigação dos consumidores de `solicitacoes_troca_titularidade`:** 27 arquivos críticos (envio do termo, aprovações Cadastro/Monitoramento, efetivar troca, SGA Hinova, Autentique webhook, badges/counters do front). Saneamento manual é **obrigatório** — fallback do hook só esconde o sintoma.

## Ordem de execução (aprovada)

### 1º — Fallback no hook (resolve UI imediatamente)

Em `src/hooks/useOutrosProcessos.ts` (bloco 244-255 + 304-396):

- Quando `tipo === 'troca_titularidade'` e `troca` é `null`, resolver titular antigo via:
  - `veiculos.placa = c.veiculo_placa` → `veiculos.associado_id` → `associados (id, nome, cpf, email, telefone)`.
- Coletar placas faltantes num único `in('placa', ...)` para não estourar quota.
- Popular `associado_antigo_email/telefone/nome/cpf` E `titular_origem_nome/cpf` a partir desse fallback.

Resultado imediato: card vermelho some, FERNANDO BENTO aparece como antigo, email visível.

### 2º — Saneamento da cotação atual (necessário, pelos consumidores)

Via migração:

- `INSERT` em `solicitacoes_troca_titularidade`:
  - `associado_antigo_id = 0c43955a-a63e-45a5-884b-c34f7b2e60ea` (FERNANDO)
  - `veiculo_id = 7bbd9ca1-49ec-4be2-957f-cd7fe5804847` (SRZ2E82)
  - `cotacao_id = 45d67b5d-7946-481c-a9f9-9bf7c5f03ce4`
  - `status = 'cotacao_em_andamento'`
  - `novo_titular_dados = { nome: 'ANDERSON LIMA AGUIAR', telefone: '21991035491' }`
  - `criado_por = vendedor_id` da cotação
  - `token_publico = gen_random_uuid()::text` (sanitizado para hex)
- `INSERT` em `logs_auditoria` com `[SANEAMENTO_TROCA]` descrevendo o caso e a causa raiz pendente.

### 3º — Guard contra recorrência (depois do saneamento)

- **Edge `vincular-cotacao-troca`**: já recebe `solicitacao_id` — confirmar que o caminho que originou a cotação órfã foi via `CotacaoFormDialog` com `origemTroca` ausente. Adicionar validação no edge `contrato-gerar` (ou no formulário) que rejeita criar cotação com `tipo_entrada='troca_titularidade'` quando não há `origem_troca_titularidade_id` no payload.
- **Trigger DB `trg_guard_cotacao_troca_exige_solicitacao`** (BEFORE INSERT em `cotacoes`):
  - Se `NEW.tipo_entrada = 'troca_titularidade'`, exigir que exista `solicitacoes_troca_titularidade` com `veiculo_id` correspondente à placa em status não-terminal (`pendente_termo`, `cotacao_em_andamento`, `aguardando_cadastro`, `aguardando_vistoria`, `aguardando_monitoramento`, `liberada_para_assinatura`) cuja `cotacao_id` seja NULL OU já aponte para `NEW.id`. Caso contrário, `RAISE EXCEPTION 'cotacao_troca_sem_solicitacao'`.
- Trigger **só pode ser criada depois** do passo 2; senão bloqueia o próprio saneamento.

### 4º — Memória

Salvar `mem://logic/operations/troca-fallback-antigo-por-veiculo` (e referenciar no index):
> Hook `useOutrosProcessos` resolve titular antigo via `veiculos.associado_id` quando `solicitacoes_troca_titularidade` ainda não existe (fallback de UI). Trigger `trg_guard_cotacao_troca_exige_solicitacao` impede futuras cotações de troca órfãs no banco. Caso histórico: COT-20260528-142801654-756 (SRZ2E82, FERNANDO → ANDERSON), saneado manualmente em 28/05/26.

## Arquivos

- `src/hooks/useOutrosProcessos.ts` — fallback (item 1)
- Migração `INSERT solicitacoes_troca_titularidade + logs_auditoria` (item 2)
- Migração `CREATE TRIGGER trg_guard_cotacao_troca_exige_solicitacao` + ajuste em `supabase/functions/contrato-gerar/index.ts` (item 3)
- `mem://logic/operations/troca-fallback-antigo-por-veiculo` + `mem://index.md` (item 4)

Sem mudança de RLS / enum / schema novo.