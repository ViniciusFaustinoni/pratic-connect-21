## Causa raiz

**Trigger `trg_servico_promove_cadastro`** (em `public.servicos`, criado pela migration `20260515140337`) promove `contratos.cadastro_aprovado=true` **automaticamente, sem aprovador humano**, sempre que um `servicos.tipo='vistoria_entrada'` muda para `status='aprovada'`. O trigger **não distingue `modalidade='autovistoria'` (autovistoria do cliente) de vistoria presencial técnica**.

### Cronologia do caso ANDREIA (cotação 68e0ede7…)

| Tempo | Evento | Efeito DB |
|---|---|---|
| 14/05 19:14 | Cotação criada (FIPE R$ 40.539 → exige rastreador; `tipo_vistoria=autovistoria` opcional) | `cotacoes.status_contratacao=pagamento_ok` |
| 14/05 20:13 | Termo assinado | `contratos.status=assinado`, `cadastro_aprovado=false` |
| 15/05 13:36 | Cliente conclui autovistoria no link público | `vistorias` (`modalidade=autovistoria, status=pendente`) + `servicos` (`tipo=vistoria_entrada, modalidade=autovistoria`) |
| 15/05 ~13:36 | `aprovar-proposta` (bloco "AUTOVISTORIA ANTECIPADA acima da FIPE") marca o servico como `status='aprovada'` (terminal, fora da fila) | `servicos.status=aprovada` |
| 15/05 14:03:33 | **Trigger `trg_servico_promove_cadastro` dispara** e chama `fn_auto_promover_cadastro_pos_operacao` | `contratos.cadastro_aprovado=true`, `aprovado_em=now()`, **`aprovado_por=NULL`** (fingerprint do auto-promove) |

**Fingerprint confirmado**: `contratos.aprovado_por IS NULL AND cadastro_aprovado=true`. Auditoria do banco mostra **3 contratos contaminados**: Andreia, Larissa Inácio (FIPE 21k sub-FIPE), João Victor (já cancelado).

### Por que o usuário vê "foi para Associados como ativo"

- `associados.status='pendente_vistoria'` (não 'ativo' literal) — os guards de Etapas 1-4 anteriores impediram a ativação real.
- Mas a **lista "Propostas Pendentes" do Cadastro filtra por `cadastro_aprovado=false`** (memória `propostas-pendentes-saida-por-vistoria`). Como o trigger setou `true`, a Andreia **saiu da fila do Cadastro** e passou a aparecer apenas em Associados, **sem nenhum analista ter visto os documentos**. Visualmente é "pulou o Cadastro".

### Violações de invariantes canônicas

1. Core: "Cadastro NUNCA recebe contrato com `cadastro_aprovado=true`" — quebrado pelo trigger.
2. Core: "Aprovação de autovistoria NUNCA fecha `instalacoes`/`servicos.tipo='instalacao'` … Triggers de pós-instalação NÃO ativam cobertura nem promovem veículo a 'ativo'" — espírito quebrado (promove o cadastro sem análise documental).
3. Manual: a autovistoria acima da FIPE é **opcional, só antecipa R/F**, e **nunca dispensa análise do Cadastro**.

---

## Plano de correção definitiva (3 frentes)

### Frente 1 — Trigger blindada (migration)

Reescrever `fn_trg_servico_promove_cadastro` para **ignorar serviços de autovistoria** e exigir um insumo presencial verificável:

- Se `NEW.modalidade = 'autovistoria'` → `RETURN NEW` sem promover.
- Se o serviço veio de uma vistoria cuja `vistorias.modalidade='autovistoria'` (via `vistoria_origem_id`) → `RETURN NEW` sem promover.
- Manter promoção apenas quando:
  - `NEW.tipo='instalacao'` e `status` terminal, **ou**
  - `NEW.tipo='vistoria_entrada'` com `modalidade<>'autovistoria'` (vistoria presencial) e `status` terminal.

Aplicar a mesma blindagem em `fn_trg_agendamento_base_promove_cadastro` quando o agendamento vier de fluxo de autovistoria (mais seguro: só promover se existir `instalacao`/`servico` presencial concluído na cadeia).

### Frente 2 — Saneamento dos contratos contaminados (migration de dados)

Para cada contrato com fingerprint `cadastro_aprovado=true AND aprovado_por IS NULL` cuja única "evidência" é um servico/vistoria de autovistoria sem instalação física concluída:

- `UPDATE contratos SET cadastro_aprovado=false, aprovado_em=NULL, aprovado_por=NULL, updated_at=now()` (formato exigido pelo `trg_protege_cadastro_aprovado`).
- Re-rodar `recompute_cotacao_status_contratacao` para a cotação voltar a posição correta da fila (`aguardando_aprovacao_cadastro`).
- Inserir `logs_auditoria` (`acao='editar'`, `modulo='contratos'`, descrição `saneamento_cadastro_auto_promovido_indevidamente`).
- Casos afetados (audit já levantada): Andreia (FIPE 40k, exige rastreador), Larissa Inácio (FIPE 21k sub-FIPE, mas sem documentação revisada pelo Cadastro), João Victor (cancelado — pular ou apenas auditar).

Andreia volta para a fila de Cadastro com a autovistoria já aprovada — assim que o analista aprovar manualmente, o caminho normal libera R/F e segue para agendamento de instalação técnica (R$ 40k exige rastreador).

### Frente 3 — Memória/regra (sem código)

- Atualizar `mem://logic/operations/autovistoria-nao-conclui-instalacao` adicionando: "Servico `vistoria_entrada` com `modalidade='autovistoria'` JAMAIS dispara auto-promoção de `cadastro_aprovado`. Trigger `trg_servico_promove_cadastro` filtra por modalidade."
- Adicionar linha no Core: "Auto-promoção de `cadastro_aprovado=true` (fingerprint `aprovado_por=NULL`) é EXCLUSIVA de vistoria presencial técnica concluída. Autovistoria do cliente nunca promove Cadastro."

---

## Arquivos afetados

- `supabase/migrations/<nova>_fix_autopromote_cadastro_autovistoria.sql` — Frentes 1 + 2 em uma migration
- `mem://logic/operations/autovistoria-nao-conclui-instalacao` + `mem://index.md` — Frente 3

## Riscos e mitigação

- **Risco**: contratos legítimos (vistoria presencial real) também caem no auto-promove e podem ser afetados se o filtro for amplo demais. **Mitigação**: filtro estrito por `modalidade='autovistoria'` (não toca presencial).
- **Risco**: saneamento reabrir contrato já em workflow do Monitoramento. **Mitigação**: query do saneamento exige `qtd_instalacoes=0` E `s.tipo='vistoria_entrada' AND s.modalidade='autovistoria'` — só pega quem nunca teve instalação técnica.
- **Risco**: Andreia já sincronizada com Hinova como ativa. **Mitigação**: `associados.status='pendente_vistoria'` (não foi para Hinova como ativo); apenas saiu da tela do Cadastro. Saneamento devolve para a fila certa.

## Verificação pós-deploy

1. `SELECT count(*) FROM contratos WHERE cadastro_aprovado=true AND aprovado_por IS NULL AND aprovado_em > now() - INTERVAL '7 days'` deve retornar 0 (após saneamento).
2. Andreia aparece em **Cadastro › Propostas Pendentes** com badge "Autovistoria aprovada · Liberar R/F".
3. Forçar UPDATE de teste em um servico autovistoria já aprovado não muda `cadastro_aprovado` de outro contrato.
