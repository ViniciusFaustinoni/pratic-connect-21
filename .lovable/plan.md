
# Como o sistema age hoje (link unificado de vistoria)

## Cenário: vendedor (ou qualquer pessoa) realiza as fotos pelo link público, e o monitoramento atribui um técnico depois

1. **Cadastro aprova documentação** em `PropostaAnalise.handleConfirmarAprovacao` → chama `gerar-link-vistoria-publica` passando `cotacaoId`.
2. A edge function tenta resolver `instalacao_id` pela cotação. Se já existir uma `instalacoes` para essa cotação, cria 1 linha em `vistoria_links` (UNIQUE por `instalacao_id`) com token público. Se ainda **não** existir instalação (caso comum logo após aprovar documentos), retorna erro 400 e o link **não é gerado** (mas como o erro é "não bloqueante", o usuário não percebe).
3. O bloco `VistoriaLinkBlock` aparece na cotação. Vendedor copia o link, envia ao associado/parceiro. Pessoa abre `/vistoria/:token`, preenche **nome livre**, sobe fotos + vídeo + observações, finaliza. `concluir-etapa-fotos-publica` marca `fotos_etapa_status='concluida'`, `fotos_executor_nome=<nome digitado>`, anexa fotos a `vistoria_fotos` (se houver `vistoria_id` resolvida) e atualiza `vistorias.video_360_url/km_atual/observacoes`.
4. Monitoramento então atribui técnico interno via `AtribuirInstaladorDialog` → grava `instalacoes.instalador_id/instalador_responsavel_id` mas **não** atualiza `vistoria_links.tecnico_atribuido_id`.
5. Técnico abre o app em `/instalador/vistoria/:id` (`ExecutarVistoriaCompleta`), que lê a vistoria pelo serviço/instalação. A página mostra **toda a vistoria como se nada tivesse sido feito** (não consulta `vistoria_links` nem detecta etapa pública concluída). Técnico tira fotos de novo, sobe vídeo de novo, conclui via `useAprovarVeiculoVistoria` → marca `vistorias.status='aprovada'`, `instalacoes.status='concluida'`, encerra serviço/agendamento e segue para aprovação do monitoramento.
6. Como o fluxo legado **não** chama `concluir-etapa-instalacao-publica`, o `vistoria_links` permanece com `instalacao_etapa_status='pendente'` e `status='fotos_concluidas'` para sempre — mesmo a vistoria já estando aprovada. O `aplicar-conclusao-vistoria` nunca dispara (mas também não precisa, pois o caminho legado já fez tudo).

## Falhas de lógica e riscos identificados

### 1) Link só nasce se já existir `instalacoes` (timing)
Aprovação documental dispara `gerar-link-vistoria-publica` com `cotacaoId`. Se a instalação ainda não foi criada, retorna 400 silenciosamente. `VistoriaLinkBlock` aparece com botão "Gerar link" e só funciona depois que alguém criar a instalação manualmente.

### 2) Duplicação de trabalho entre link público e app do técnico interno
`ExecutarVistoriaCompleta` ignora `vistoria_links`. Se as fotos já foram feitas pelo vendedor, técnico vê tudo zerado e refaz. `useAprovarVeiculoVistoria` marca `vistorias.status='aprovada'` direto sem passar pelo link — `vistoria_links` fica eternamente "fotos_concluidas".

### 3) Atribuição não sincroniza para o link
`AtribuirInstaladorDialog` só atualiza `instalacoes`. `vistoria_links.tecnico_atribuido_id` continua nulo, e o nome não vem pré-preenchido nem travado na etapa pública.

### 4) Identidade do executor das fotos não é validada
Qualquer pessoa com o token digita qualquer nome. Sem vínculo com `profiles`/vendedor/associado. Auditoria fraca.

### 5) Conflito de status quando a etapa de fotos é refeita pelo técnico
Se técnico faz tudo via app legado, link continua "pendente". Coordenador olha `VistoriaLinkBlock` e parece que ninguém fez nada.

### 6) RLS permissiva em `vistoria_links`
`USING (true) WITH CHECK (true)` permite qualquer authenticated alterar/cancelar qualquer link.

### 7) Bucket `vistoria-prestador-fotos` chamado com `publicSupabase` (anon)
Se o bucket não tiver policy permitindo INSERT anônimo nas pastas `<token>/*`, o upload falha silenciosamente.

### 8) Conclusão final não respeita "monitoramento aprova primeiro"
`aplicar-conclusao-vistoria` marca `vistorias.status='aprovada'` automaticamente quando ambas etapas terminam. Pula a aprovação manual do monitoramento que o usuário pediu explicitamente.

### 9) Hodômetro/observações sobrescrevem dados do técnico
Etapa pública atualiza `vistorias.km_atual` e `observacoes` sem checar se já foram preenchidos.

### 10) Cancelamento/reagendamento de instalação não invalida o link
Token continua válido mesmo após cancelamento da instalação.

### 11) Início de etapa pelo link NÃO espelha "em andamento" para o monitoramento  ⭐ NOVA
Hoje, quando alguém (técnico, vendedor, associado) abre o link e clica em uma das etapas, **nada** muda em `instalacoes.status` nem em `vistorias.status`. O painel do monitoramento (`VistoriasInstalacoesMon`, mapa, dashboards) continua mostrando a tarefa como `agendada`, mesmo com o técnico já trabalhando. Só vai aparecer "em andamento" se o técnico tiver entrado pelo app interno (`ExecutarVistoriaCompleta` → `iniciarInstalacao` grava `status='em_andamento'` + `iniciada_em`).

---

# Plano de adaptação

## A) Geração do link no momento certo
1. Em `PropostaAnalise.handleConfirmarAprovacao`, garantir `instalacoes` esqueleto (status `pendente_agendamento`) antes de chamar `gerar-link-vistoria-publica`. Alternativamente, a própria edge cria a instalação esqueleto se não existir.
2. Toast de erro real quando a geração falhar (em vez de silencioso).

## B) Sincronizar atribuição de técnico → link
1. `useInstalacaoActions.atribuirInstalador` faz upsert em `vistoria_links.tecnico_atribuido_id` (ou `prestador_atribuido_id`) após gravar a instalação.
2. Reatribuição substitui o valor.

## C) Unificar app do técnico com o link público
- `ExecutarVistoriaCompleta` lê `vistoria_links`. Se etapa de fotos já estiver `concluida`, esconde blocos de fotos/vídeo e mostra badge "Fotos enviadas por <nome> em <data>". Técnico só faz a etapa de instalação.
- Conclusão do técnico chama as edges públicas (`concluir-etapa-fotos-publica` e/ou `concluir-etapa-instalacao-publica`) em vez de `useAprovarVeiculoVistoria`. `aplicar-conclusao-vistoria` continua sendo o ponto único de finalização.
- Vistorias antigas sem `vistoria_links` caem no comportamento legado (compat).

## D) Aprovação manual do monitoramento antes da conclusão final
- `aplicar-conclusao-vistoria` deixa de marcar `vistorias.status='aprovada'`. Marca `vistorias.status='aguardando_aprovacao_monitoramento'` (status já existente no fluxo). `instalacoes.status` vira `concluida` (técnico terminou fisicamente), mas SGA/ativação continua pendente até o monitoramento aprovar via tela existente.

## E) Identidade e auditoria do executor das fotos
- Etapa de fotos exige nome + telefone do executor. Salvar `fotos_executor_telefone`, `fotos_executor_user_id` (se logado), `fotos_executor_ip`, `fotos_executor_user_agent` em `vistoria_links`.

## F) Endurecer RLS de `vistoria_links`
- INSERT/UPDATE só para `monitoramento`, `cadastro`, `diretor` e service role.
- SELECT público mantém-se mas filtrado por `status != 'cancelado'`.
- Bucket `vistoria-prestador-fotos`: policy permitindo INSERT anônimo apenas em `<token>/*` onde token existe e link não está cancelado, OU edge function `upload-foto-vistoria-publica` que valida o token.

## G) Consistência de dados duplicáveis
- `concluir-etapa-fotos-publica` só sobrescreve `vistorias.km_atual/observacoes` se vierem não-nulos **e** o campo estiver vazio. Mesma regra na ordem inversa.

## H) Invalidar link quando a instalação muda de estado
- Trigger `instalacoes_cancel_vistoria_link` AFTER UPDATE: se `status` virar `cancelada`, marca `vistoria_links.status='cancelado'`.
- Nova instalação para a mesma cotação gera novo link.

## I) Ajustes de UX
- `VistoriaLinkBlock` mostra timestamp e nome de quem fez cada etapa, botão "Reenviar link por WhatsApp".
- Geração/regeneração restrita a cadastro/monitoramento/diretor.
- Banner em `ExecutarVistoriaCompleta`: "Fotos já realizadas por <nome> — você só precisa concluir a instalação".

## J) Espelhar "em andamento" para o monitoramento ao iniciar pelo link  ⭐ NOVA

**Regra:** assim que **alguém** (qualquer executor) clica em "Realizar Fotos e Vídeo" ou "Realizar Instalação do Rastreador" no link público, o sistema marca a tarefa como em andamento para o monitoramento — sem esperar a conclusão.

**Comportamento por etapa:**
- Ao tocar **"Realizar Fotos e Vídeo"** pela primeira vez:
  - `vistoria_links.fotos_etapa_status` → `em_andamento` (já existe na tabela)
  - `vistoria_links.iniciada_em` ← `now()` (se nula)
  - `vistorias.status` → `em_andamento`, `vistorias.iniciada_em` ← `now()` (se nula)
  - `instalacoes.status` → `em_andamento`, `instalacoes.iniciada_em` ← `now()` (se nula)
  - `servicos` (vinculado via `vistoria_origem_id`): status `em_andamento`, `iniciada_em` ← `now()`
  - `agendamentos_base` vinculado: status `em_andamento` (se este status existir; senão deixar como está)
- Ao tocar **"Realizar Instalação do Rastreador"** pela primeira vez (e a etapa anterior ainda não estiver `em_andamento` nem `concluida`): mesma propagação.
- Se já estiver em andamento por causa da outra etapa, apenas idempotente (não regride status nem mexe em `iniciada_em`).
- Se a tarefa estiver `concluida`/`cancelada` no fluxo legado, **não** regredir — bloqueio defensivo.

**Identidade de quem iniciou:**
- Se o link tem `tecnico_atribuido_id` e a sessão pública tem o user logado batendo, marcar `vistorias.tecnico_id` (se nulo) e gravar `vistoria_links.iniciada_por_user_id` (nova coluna).
- Se for execução pública por terceiro (vendedor/associado), gravar nome+telefone do início (mesmas colunas de auditoria do plano E), sem alterar `vistorias.tecnico_id`.

**Implementação:**
- Nova edge function `iniciar-etapa-vistoria-publica` (anon-callable), recebe `{ token, etapa: 'fotos'|'instalacao', executor_nome?, executor_telefone? }`. Faz toda a propagação acima em uma transação lógica (sequência de updates). Idempotente.
- Front (`VistoriaPublica.tsx`): no `onClick` de cada botão da home, chamar a edge antes de navegar para a tela da etapa. Não bloquear navegação se a edge falhar (toast de aviso, mas deixa o executor continuar — a conclusão depois reconcilia).
- Reaproveitar a já existente lógica de "em andamento" do mapa/painel: nenhum código de monitoramento muda, basta os campos `instalacoes.status` e `vistorias.status` virarem `em_andamento` que tudo aparece corretamente (mapa pinta pin azul, dashboards contam, ETA roda).

**Reversão controlada (edge cases):**
- Se a etapa for abandonada (executor fecha o navegador), o status fica `em_andamento` indefinidamente. Mitigação: job/cron já existente que detecta `em_andamento` há mais de N horas pode emitir alerta para o monitoramento (não criamos nada novo, só documentamos a expectativa).
- Se o executor cancelar/fechar antes de subir nada, sem problema — a etapa segue `em_andamento` e só vira `concluida` quando ele finalizar de fato.

---

# Detalhes técnicos

**Banco**
- Migração: `vistoria_links` ganha `fotos_executor_telefone text`, `fotos_executor_user_id uuid`, `fotos_executor_ip text`, `fotos_executor_user_agent text`, `iniciada_por_user_id uuid`, `iniciada_por_nome text`.
- Migração: novas RLS policies em `vistoria_links` baseadas em `has_role`.
- Migração: trigger `instalacoes_cancel_vistoria_link` (cancela link quando instalação cancela).
- Storage: revisar policies de `vistoria-prestador-fotos` para INSERT anon limitado por token válido.

**Edge functions**
- `gerar-link-vistoria-publica`: cria instalação esqueleto se faltar; retorna erro explícito.
- `iniciar-etapa-vistoria-publica` (NOVA): propaga `em_andamento` para link/vistoria/instalação/serviço.
- `concluir-etapa-fotos-publica`: deixa `km_atual/observacoes` opcionais e não-sobrescritivos; aceita auditoria do executor.
- `concluir-etapa-instalacao-publica`: já trava nome quando há atribuição interna (mantido).
- `aplicar-conclusao-vistoria`: troca `vistorias.status='aprovada'` por `'aguardando_aprovacao_monitoramento'`.
- Nova `sincronizar-tecnico-vistoria-link` chamada em `atribuirInstalador`.

**Frontend**
- `useInstalacaoActions.atribuirInstalador`: chama `sincronizar-tecnico-vistoria-link` no sucesso.
- `ExecutarVistoriaCompleta`: lê `vistoria_links`, renderiza condicionalmente, finaliza via edges públicas.
- `VistoriaPublica`: dispara `iniciar-etapa-vistoria-publica` ao clicar em cada etapa; bloqueia se link cancelado.
- `PropostaAnalise`: garante instalação esqueleto antes do link.

**Compatibilidade**
- Vistorias sem `vistoria_links` mantêm comportamento legado.
- Aprovação do monitoramento (`useAprovarMonitoramento`) continua sendo o único caminho que dispara SGA/ativação Hinova.
