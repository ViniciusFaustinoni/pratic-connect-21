
## Diagnóstico (sem alterar dados)

Confirmei no banco que as duas solicitações citadas estavam exatamente no padrão "status=`aguardando_vistoria` + `servico_vistoria_id` apontando para serviço criado só no backfill de ontem":

- **LQY5543** (sol. `50e43757…`): criada 08/06 17:44, virou `aguardando_vistoria` no clique do Monitoramento, mas o `servicos` (`f634e0f8…`) só foi inserido em 09/06 22:49 (backfill). ~29 h em limbo.
- **LUJ0G95** (sol. `aaf27c03…`): criada 05/06, idem — serviço (`38788e9a…`) inserido em 09/06 22:51. ~4 dias em limbo.

A branch `solicitar_vistoria` em `supabase/functions/aprovar-troca-monitoramento/index.ts` hoje já materializa o `servicos` antes do UPDATE da solicitação. Antes da reescrita, ela só atualizava `status='aguardando_vistoria'` + WhatsApp — daí o sumiço da Atribuição Manual (que filtra por `servicos` vivos com `origem='troca_titularidade'`).

Mesmo com a branch corrigida, o **fluxo canônico continua sem rede de segurança**:

1. INSERT do `servicos` e UPDATE da solicitação são feitos em chamadas separadas. Se o INSERT passar e o UPDATE falhar, há rollback manual; se o UPDATE passar e o INSERT for revertido por trigger silenciosa (ou regressão futura no código), volta a limbo.
2. Não há **guard de banco** impedindo `status` virar `aguardando_vistoria`/`aguardando_manutencao` sem o `servico_*_id` correspondente apontando para serviço vivo.
3. Não há **cron** que detecte solicitação parada em `aguardando_vistoria`/`aguardando_manutencao` com serviço NULL/cancelado/excluído.
4. A tela de **Aprovações de Troca** (Monitoramento) não tem badge/aviso quando a solicitação está em `aguardando_vistoria` sem serviço vivo — coordenador só descobre quando alguém reclama.

Isso é o que mantém a possibilidade de limbo, mesmo com a edge function consertada.

## Plano canônico (4 camadas, defesa em profundidade)

### 1. Atomicidade da transição (edge function)

Substituir o par `INSERT servicos` + `UPDATE solicitacoes_troca_titularidade` por uma **RPC SQL `SECURITY DEFINER`** (`fn_troca_solicitar_vistoria`, `fn_troca_solicitar_retirada`, `fn_troca_agendar_manutencao`) que faz tudo numa transação única. Edge function passa a só validar e chamar a RPC. Fim do rollback manual com `await admin.from('servicos').delete()` no catch.

### 2. Guard de banco (trigger BEFORE UPDATE em `solicitacoes_troca_titularidade`)

`trg_guard_troca_status_exige_servico`:

- `NEW.status = 'aguardando_vistoria'` exige `NEW.servico_vistoria_id` não-nulo apontando para `servicos` com `status NOT IN ('cancelada','excluida')`.
- `NEW.status = 'aguardando_manutencao'` exige `NEW.servico_manutencao_id` idem.
- Mensagem de erro com `HINT` apontando para a RPC canônica.

Bloqueia regressões futuras (qualquer edge, script ou painel que tente atalho).

### 3. Cron de detecção + auto-recuperação (`reconciliar-troca-titularidade-limbo`, 15 min)

Varre `solicitacoes_troca_titularidade` onde:

- `status IN ('aguardando_vistoria','aguardando_manutencao')`
- AND (`servico_*_id IS NULL` OR serviço associado em `cancelada`/`excluida`/inexistente)
- AND `updated_at < now() - interval '15 min'`

Para cada uma:

- Se há `tipo_vistoria_troca` e endereço gravado em `novo_titular_dados` → re-materializa via RPC canônica (mesmo caminho).
- Senão → insere `notificacoes_sistema` (destino=role monitoramento, dedup 1h) + `analises_relacionamento` (`tipo='troca_limbo_pos_monitoramento'`) com link direto para a solicitação.

Loga tudo em `logs_auditoria` com prefixo `[reconcilia_troca_limbo]`.

### 4. Visibilidade na fila do Monitoramento

Na lista de Aprovações de Troca (`/monitoramento/aprovacoes-troca` e variantes):

- Badge âmbar "**Sem serviço materializado**" em solicitações `aguardando_vistoria`/`aguardando_manutencao` cujo `servico_*_id` esteja NULL ou aponte para serviço cancelado.
- Botão "**Re-materializar serviço**" no `ModalDetalhesTroca` (modo monitoramento) que chama a mesma RPC canônica.
- Chip no topo da fila: "Em limbo: N" (count das mesmas).

Mesma estratégia já usada para handoff fotos→rota (memória `handoff-fotos-rota-visibilidade`).

## Detalhes técnicos

- **Tabelas afetadas**: nenhuma alteração de schema; apenas novas funções/triggers/cron em migração.
- **Migrations**:
  - `fn_troca_solicitar_vistoria`, `fn_troca_solicitar_retirada`, `fn_troca_agendar_manutencao` (SECURITY DEFINER, GRANT EXECUTE TO service_role, authenticated).
  - `trg_guard_troca_status_exige_servico` (BEFORE INSERT OR UPDATE OF status).
  - `fn_reconciliar_troca_titularidade_limbo` + agendamento pg_cron 15 min.
- **Edges**: `aprovar-troca-monitoramento` passa a chamar as RPCs; comportamento externo (payload/status codes) inalterado.
- **Front**: `ModalDetalhesTroca`, `AprovacoesTroca`, `AprovacoesUnificadas` — adicionar badge/contador/botão "re-materializar".
- **Memória**: registrar `mem://logic/operations/troca-titularidade-anti-limbo-pos-monitoramento` (princípio canônico + 4 camadas).

## O que NÃO faço

- Não toco em LQY5543 / LUJ0G95 (já backfillados).
- Não altero o gate canônico Cadastro→Monitoramento — a exceção `origem='troca_titularidade'` continua igual.
- Não mexo em outros fluxos (substituição, sub-FIPE, manutenção avulsa).
