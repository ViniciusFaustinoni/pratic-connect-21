## Contexto

A infraestrutura de auditoria já existe:

- Tabela `public.logs_auditoria` (usuario_id, usuario_nome, acao, modulo, tabela, registro_id, dados_anteriores, dados_novos, descricao, ip_address, user_agent, created_at).
- Helper frontend `registrarLog()` em `src/hooks/useAuditLog.ts` (chamado em alguns fluxos).
- Tela `/diretoria/logs` (`src/pages/diretoria/LogsAuditoria.tsx`) com filtros por ação/módulo/tabela/data/busca.

**Problema:** hoje só caem logs gerados manualmente nos pontos que chamam `registrarLog` (concentrados em cotações, contratos, instalações, veículos, associados parciais). Ações como "técnico iniciou serviço", "atribuição de prestador", "mudança em cadastro", "aprovação de vistoria/sinistro/diretoria", "alteração de plano/comissão", etc. não caem porque dependeriam de chamadas espalhadas em dezenas de telas/edges.

## Estratégia

Mover a auditoria para o **banco**, via trigger genérico que captura toda escrita em uma whitelist de tabelas críticas. O usuário executor é resolvido a partir do JWT (`auth.uid()` → `profiles`). Isso captura tudo automaticamente — UI, edge functions, scripts — sem precisar instrumentar cada ponto.

### 1. Função genérica de auditoria (migration)

Criar `public.fn_auditoria_generica()` (`SECURITY DEFINER`) que, para cada `TG_OP`:

- Calcula `usuario_id`/`usuario_nome` via `auth.uid()` + `profiles` (fallback para `'Sistema'` quando não houver JWT — edges com service role).
- Mapeia `TG_TABLE_NAME` para `modulo` via `CASE` (ex.: `servicos`/`agendamentos_base`/`vistorias`/`instalacoes` → `operacoes`; `associados` → `associados`; `contratos`/`contratos_historico` → `contratos`; `veiculos` → `veiculos`; `aprovacoes_*` → `aprovacoes`; `user_roles`/`profiles` → `usuarios`; `planos`/`coberturas`/`beneficios*` → `planos`; `grades_comissao*`/`hierarquia_vendas`/`comissoes*` → `comissoes`).
- Determina `acao` por heurística:
  - `INSERT` → `criar`.
  - `DELETE` → `excluir`.
  - `UPDATE` em coluna `status`: se passou para `ativo`/`aprovado`/`concluida` → `aprovar`/`ativar`/`concluir`; se `cancelado`/`reprovado` → `reprovar`/`cancelar`; se passou a ter `prestador_id`/`vendedor_id`/`tecnico_id` → `atribuir`; senão `editar`.
- Calcula diff: `dados_anteriores`/`dados_novos` apenas com colunas que mudaram (usar `to_jsonb(OLD)`/`to_jsonb(NEW)` filtrado), evitando colunas ruidosas (`updated_at`, `embeddings`, etc.).
- Gera `descricao` curta (`<acao> em <tabela> #<registro_id>` + nome humano quando disponível: placa, nome, número do contrato).
- Insere em `logs_auditoria` (silenciar erros via `EXCEPTION WHEN OTHERS THEN ...` para nunca derrubar a operação principal).

Adicionar nova ação `'concluir'` ao enum implícito (texto livre — só listar nos filtros da UI).

### 2. Triggers nas tabelas críticas (migration)

Anexar `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW EXECUTE FUNCTION fn_auditoria_generica()` em:

- **Operações:** `servicos`, `agendamentos_base`, `vistorias`, `vistoria_fotos`, `instalacoes`, `acionamentos_roubo_furto`, `despacho_reboque`, `chamados_assistencia`, `confirmacoes_agendamento`, `encaixes_urgentes`, `ordens_servico`.
- **Cadastro:** `associados`, `veiculos`, `contratos`, `contratos_documentos`, `documento_gerados`.
- **Comercial/comissões:** `cotacoes`, `hierarquia_vendas`, `usuario_grade_comissao`, `grades_comissao`, `grades_comissao_versoes`, `comissoes_pagamentos`, `cc_vendedor_lancamentos`.
- **Aprovações:** `aprovacoes_fipe_diretoria`, `aprovacoes_fipe_menor`, `aprovacoes_elegibilidade`, `chat_solicitacoes_ia`.
- **Acesso/usuários:** `profiles`, `user_roles`, `app_roles_config`.
- **Produto/preço:** `planos`, `coberturas`, `beneficios`, `beneficios_adicionais`, `entity_eligibility_rules`, `campanhas_desconto`.
- **Cobrança/sinistros:** `cobrancas`, `acordos`, `sinistros` (se existir como tabela), `caso_juridico_historico`.

Tabelas que já têm triggers próprias (`audit_cotacao_delete`, `fn_log_associado_status_change`, `log_rastreador_vinculo_change`, `log_error_report_status_change`) continuam — o trigger genérico complementa sem duplicar (a função detecta `pg_trigger_depth() > 1` para evitar reentrância caso necessário).

### 3. Tabelas a NÃO auditar (ruído)

Excluir explicitamente da whitelist (ou nunca anexar trigger): `client_telemetry`, `edge_functions_logs`, `auth_logs`, `auth_tentativas`, `auth_sessoes`, `cobranca_eventos`, `asaas_webhooks_log`, `api_leads_logs`, `cotacoes_historico`, `contratos_historico`, `associados_historico` (já são históricos), `chat_mensagens_ia`, `client_telemetry`, `*_metrics`, `*_log` antigos.

### 4. Atualizar a UI `/diretoria/logs`

Em `src/pages/diretoria/LogsAuditoria.tsx`:

- Ampliar `acaoConfig` com `concluir`, `iniciar`, `cancelar`, `sincronizar`.
- Ampliar `moduloOptions` com `operacoes`, `aprovacoes`, `vendas`, `vistorias`, `instalacoes`, `eventos`, `juridico`, `cadastro`.
- Trocar `tabelaOptions` (hoje só comissões) por uma lista derivada de `select distinct tabela from logs_auditoria` via query, para os filtros refletirem o que realmente está sendo logado.
- Manter o restante (export CSV, expand row com diff) inalterado.

### 5. Backfill / verificação

Após aplicar a migration, rodar SELECT de smoke test (já em modo build) confirmando que um UPDATE em `servicos.status` gera linha em `logs_auditoria` com `acao='iniciar'` e `usuario_nome` preenchido.

## Detalhes técnicos

- Função em PL/pgSQL, `SECURITY DEFINER`, `SET search_path = public, auth`.
- Resolver usuário: `select id, nome from profiles where user_id = auth.uid() limit 1`. Se nulo → `usuario_nome = 'Sistema'`.
- Diff: iterar `jsonb_each(to_jsonb(NEW))` e comparar com `to_jsonb(OLD)`, ignorando lista fixa (`updated_at`, `created_at`, `search_vector`, `embedding`).
- `registro_id`: tentar `NEW.id` (cast para uuid via `(to_jsonb(NEW)->>'id')::uuid` em bloco `EXCEPTION` para tabelas sem `id` uuid).
- `descricao`: `format('%s em %s', acao, TG_TABLE_NAME)` + sufixo opcional via lookup de coluna conhecida (`placa`, `nome`, `numero`, `codigo`).
- Trigger genérico acrescenta ~1ms por write; aceitável para tabelas alvo (não está na hot-path de telemetria).

## Arquivos afetados

- **Nova migration**: `fn_auditoria_generica()` + ~30 `CREATE TRIGGER`.
- **Edit:** `src/pages/diretoria/LogsAuditoria.tsx` (filtros) e, opcionalmente, `src/hooks/useAuditLog.ts` (adicionar `'iniciar'`/`'concluir'`/`'sincronizar'` ao tipo `AcaoAuditoria`).

## Fora de escopo

- Logs de leitura ("visualizou X") — não solicitado e geraria volume gigante.
- Auditoria de webhooks externos (Asaas/Hinova) — já existem tabelas dedicadas.
- Retenção/particionamento da `logs_auditoria` — pode entrar em iteração futura se o volume crescer.
