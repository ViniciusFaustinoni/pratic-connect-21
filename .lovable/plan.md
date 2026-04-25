
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
- Hoje a aprovação documental dispara `gerar-link-vistoria-publica` com `cotacaoId`. Se a instalação ainda não foi criada (a maioria dos casos), a função retorna 400 silenciosamente e o link nunca é criado.
- Resultado: o `VistoriaLinkBlock` aparece com botão "Gerar link" e só funciona depois que alguém criar a instalação manualmente, contradizendo o requisito ("após aprovar documentos, o link deve estar pronto").

### 2) Duplicação de trabalho entre link público e app do técnico interno
- `ExecutarVistoriaCompleta` ignora `vistoria_links`. Se as fotos já foram feitas pelo vendedor, o técnico vê tudo zerado e refaz — desperdício de tempo, fotos duplicadas em `vistoria_fotos` (upsert por `vistoria_id+tipo` sobrescreve as do vendedor).
- O caminho legado (`useAprovarVeiculoVistoria`) marca `vistorias.status='aprovada'` direto, sem passar pelo `concluir-etapa-instalacao-publica` — `vistoria_links` fica eternamente "fotos_concluidas".

### 3) Atribuição não sincroniza para o link
- `AtribuirInstaladorDialog` atualiza só `instalacoes`. `vistoria_links.tecnico_atribuido_id` continua nulo, então mesmo que o técnico abrisse o link público, o nome dele não viria pré-preenchido nem travado.

### 4) Identidade do executor das fotos não é validada
- Qualquer pessoa com o token digita qualquer nome em `executor_nome`. Não há vínculo com `profiles`, vendedor ou associado. Auditoria fraca: não dá pra saber que foi o vendedor X quem subiu.

### 5) Conflito de status quando a etapa de fotos é refeita pelo técnico
- Se técnico interno faz tudo via app (`ExecutarVistoriaCompleta`), o link continua "pendente". Se o coordenador olhar o `VistoriaLinkBlock` na cotação, vai parecer que ninguém fez nada — UI inconsistente com a realidade.

### 6) RLS permissiva em `vistoria_links_authenticated_update` e `_insert`
- `USING (true) WITH CHECK (true)` permite qualquer authenticated alterar/cancelar qualquer link. Risco de manipulação por usuários sem permissão (vendedor externo, agência, etc.).

### 7) Bucket de upload `vistoria-prestador-fotos` chamado com `publicSupabase` (anon)
- Se o bucket não tiver policy permitindo INSERT anônimo, o upload falha silenciosamente. Precisa verificar/garantir policy específica para `vistoria-prestador-fotos` aceitar anon nas pastas `<token>/*`.

### 8) Conclusão final não respeita "monitoramento aprova primeiro"
- `aplicar-conclusao-vistoria` já marca `vistorias.status='aprovada'` automaticamente quando ambas etapas terminam. Isso pula a aprovação manual do monitoramento que o usuário pediu explicitamente ("Somente após as duas etapas... o associado é ativado aqui e no SGA"). A ativação de associado/SGA realmente não é feita aqui — mas marcar a vistoria como `aprovada` direto pode disparar outros gatilhos (laudo PDF, histórico, etc.) sem aval humano.

### 9) Hodômetro/observações sobrescrevem dados do técnico
- A etapa de fotos pública atualiza `vistorias.km_atual` e `observacoes`. Se o técnico preencher depois pelo app legado, sobrescreve novamente — ou vice-versa, dependendo da ordem.

### 10) Cancelamento/reagendamento de instalação não invalida o link
- Se a instalação for cancelada/reagendada, o token continua válido e qualquer um com a URL pode subir fotos para uma vistoria zumbi.

---

# Plano de adaptação

## A) Geração do link no momento certo

1. **Criar a `instalacoes` automaticamente ao aprovar a documentação** (se ainda não existir) — em `PropostaAnalise.handleConfirmarAprovacao`, depois de `aprovarMutation`, chamar uma rotina que garanta a instalação base (status `pendente_agendamento`) antes de chamar `gerar-link-vistoria-publica`.
2. Alternativamente: alterar `gerar-link-vistoria-publica` para criar a instalação esqueleto se não existir.
3. Logar e exibir toast de erro real quando a geração falhar (em vez de silencioso).

## B) Sincronizar atribuição de técnico → link

1. No `useInstalacaoActions.atribuirInstalador`, depois de gravar `instalacoes.instalador_id`, fazer upsert em `vistoria_links.tecnico_atribuido_id`.
2. Quando trocar o técnico (reatribuir), atualizar também o link.
3. Quando o link já tem `tecnico_atribuido_id`, a UI pública pré-preenche e trava o campo "nome" da etapa de instalação (já implementado server-side em `concluir-etapa-instalacao-publica`).

## C) Unificar app do técnico com o link público

Esta é a correção mais importante para evitar retrabalho. Duas opções:

- **Opção 1 (recomendada):** `ExecutarVistoriaCompleta` passa a **ler `vistoria_links`** ao abrir. Se a etapa de fotos já estiver `concluida`, esconde os blocos de fotos/vídeo e mostra badge "Fotos enviadas por <fotos_executor_nome> em <data>". Técnico só executa a etapa de instalação (checklist + fotos do rastreador). Ao concluir, em vez de chamar diretamente `useAprovarVeiculoVistoria`, chama `concluir-etapa-instalacao-publica` (que dispara `aplicar-conclusao-vistoria` automaticamente). Se a etapa de fotos ainda não estiver concluída, ao terminar a vistoria completa o app chama `concluir-etapa-fotos-publica` + `concluir-etapa-instalacao-publica` em sequência.
- **Opção 2 (mais simples):** manter `ExecutarVistoriaCompleta` como está, mas ao concluir, atualizar `vistoria_links` marcando ambas as etapas como `concluida` com `instalacao_executor_tipo='interno'`, para manter consistência de UI. Não evita retrabalho mas resolve o status.

A Opção 1 é a que entrega o requisito original ("não trava o processo, qualquer um faz fotos, técnico faz só a instalação").

## D) Aprovação manual do monitoramento antes da conclusão final

- Alterar `aplicar-conclusao-vistoria` para **não** marcar `vistorias.status='aprovada'` automaticamente. Em vez disso, marcar `vistorias.status='em_analise_monitoramento'` (ou flag equivalente) e deixar o monitoramento decidir aprovar/reprovar via tela existente (`VistoriasInstalacoesMon`).
- A `instalacoes.status` permanece `concluida` (o técnico já terminou fisicamente), mas a aprovação que dispara SGA/ativação fica nas mãos do monitoramento — comportamento já existente, só precisa não ser pulado.

## E) Identidade e auditoria do executor das fotos

- No link público, quando o usuário abre a etapa de fotos, exigir um dos:
  - Nome livre + telefone (mínimo) registrado em `vistoria_links.fotos_executor_nome` + nova coluna `fotos_executor_telefone`.
  - OU, se o link foi aberto a partir de uma sessão autenticada (vendedor logado clicou em "Abrir link"), capturar o `auth.uid()` em nova coluna `fotos_executor_user_id`.
- Registrar IP/user-agent em `vistoria_links` para auditoria mínima.

## F) Endurecer RLS de `vistoria_links`

- Trocar `USING (true) WITH CHECK (true)` por policies que validem papel:
  - INSERT/UPDATE só para `monitoramento`, `cadastro`, `diretor` e service role.
  - SELECT público mantém-se (token é o segredo), mas **filtrado por `status != 'cancelado'`** para evitar acesso a links cancelados.
- Garantir que o bucket `vistoria-prestador-fotos` tem policy permitindo `INSERT` anônimo apenas em pastas que casam com tokens existentes (regex `^[0-9a-f]{64}/`), ou usar uma edge function `upload-foto-vistoria-publica` que valida o token antes de assinar a URL.

## G) Consistência de dados duplicáveis

- `concluir-etapa-fotos-publica` só sobrescreve `vistorias.km_atual/observacoes` se vierem **não-nulos** e o campo estiver vazio (proteção contra sobrescrever o que o técnico já preencheu). Mesma regra na ordem inversa em `ExecutarVistoriaCompleta`.

## H) Invalidar link quando a instalação muda de estado

- Trigger `vistoria_links_invalidate_on_instalacao_change`: quando `instalacoes.status` virar `cancelada` ou a instalação for deletada/recriada, marcar `vistoria_links.status='cancelado'`. Quando criar nova instalação para a mesma cotação, gerar novo link.

## I) Ajustes de UX

- `VistoriaLinkBlock` mostrar timestamp e nome de quem fez cada etapa, com botão "Reenviar link por WhatsApp" (template novo).
- Esconder botão "Gerar link" para quem não tem permissão (apenas cadastro/monitoramento/diretor).
- Em `ExecutarVistoriaCompleta`, banner no topo: "Etapa de fotos já realizada por <nome> em <data> — você só precisa concluir a instalação do rastreador".

---

# Detalhes técnicos

**Banco**
- Migração: adicionar colunas `fotos_executor_telefone text`, `fotos_executor_user_id uuid`, `fotos_executor_ip text`, `fotos_executor_user_agent text` em `vistoria_links`.
- Migração: novas RLS policies em `vistoria_links` baseadas em `has_role(auth.uid(), 'monitoramento'|'cadastro'|'diretor')`.
- Migração: trigger `instalacoes_cancel_vistoria_link` AFTER UPDATE para cancelar link quando instalação for cancelada.
- Storage: revisar/criar policies em `vistoria-prestador-fotos` para INSERT anon limitado por token.

**Edge functions**
- `gerar-link-vistoria-publica`: criar instalação esqueleto se não existir; retornar erro explícito (não silencioso) ao chamador.
- `concluir-etapa-fotos-publica`: deixar `km_atual/observacoes` opcionais e não-sobrescritivos; aceitar `executor_telefone`, `executor_user_id`, capturar `req.headers` para IP/UA.
- `aplicar-conclusao-vistoria`: trocar `vistorias.status='aprovada'` por `'em_analise_monitoramento'` (ou equivalente) e remover qualquer disparo que pressuponha aprovação humana.
- Nova edge `sincronizar-tecnico-vistoria-link`: chamada por `useInstalacaoActions.atribuirInstalador`.

**Frontend**
- `useInstalacaoActions.atribuirInstalador`: após sucesso, invocar `sincronizar-tecnico-vistoria-link`.
- `ExecutarVistoriaCompleta`: ler `vistoria_links` por `instalacao_id`; renderizar condicionalmente blocos de fotos vs. instalação; ao finalizar, chamar as edges públicas equivalentes em vez de `useAprovarVeiculoVistoria`.
- `VistoriaPublica`: bloquear etapa de fotos se o link estiver `cancelado`, mostrar quem já realizou cada etapa.
- `PropostaAnalise`: garantir instalação esqueleto antes de gerar o link, ou tratar erro real do `gerar-link-vistoria-publica`.

**Compatibilidade**
- Nenhuma quebra para vistorias antigas (sem `vistoria_links`): `ExecutarVistoriaCompleta` cai no comportamento legado quando o link não existir.
- Aprovação do monitoramento (`useAprovarMonitoramento`) continua sendo o único caminho que dispara SGA/ativação Hinova.
