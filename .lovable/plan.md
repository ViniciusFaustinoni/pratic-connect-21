## Pacote 2: Escopo por papel + Saúde SGA + Mini-card de Vistoria

### 1. Escopo por papel em `ProcessosOperacionais` (Cadastro › Processos)

**Hoje**: `scopeToSelf = permissions.isVendedorOnly`. Funciona para vendedor, mas:
- Vendedores CLT (`isVendedorClt`) e externos (`isVendedorExterno`) que também tenham outro papel não privilegiado escapam do filtro.
- Não há restrição por setor: qualquer pessoa com acesso à página vê todas as abas/sub-abas, e o `modo` do `ModalDetalhesTroca` é fixo em `cadastro` mesmo para Monitoramento.

**Mudança**:

a) **Regra de visibilidade total** (ver tudo):
   - `isDiretor || isAdminMaster || isDesenvolvedor || isSupervisorVendas || isGerente || isAnalistaCadastro` → vê todos os processos.
   - Caso contrário (vendedor, agência, vendedor CLT/externo sem cargo de gestão) → escopo = só os próprios (filtro por `criado_por`/`vendedor_id`/`consultor_id`).
   - Substituir `permissions.isVendedorOnly` por uma variável local `canSeeAll` derivada das flags acima. Mantém os parâmetros `scopeProfileId` / `scopeAuthUserId` já implementados.

b) **Aviso visual**: manter o `<Alert>` "Mostrando apenas as solicitações originadas por você" quando `!canSeeAll`.

### 2. Modal de detalhes da troca: `modo` por papel

**Hoje**: a aba Titularidade abre `ModalDetalhesTroca` sempre com `modo="cadastro"`. As ações de aprovar/reprovar Cadastro aparecem para qualquer um.

**Mudança em `TrocaTitularidadeTab`**:
- Determinar o `modo` dinamicamente:
  - `isAnalistaCadastro` (e não Monitoramento) → `modo="cadastro"`.
  - `isCoordenadorMonitoramento || isAnalistaMonitoramento` (e não Cadastro) → `modo="monitoramento"`.
  - Diretor/Supervisor/Gerente/SuperAdmin → modo derivado do `status` da solicitação: `aguardando_monitoramento`/`aguardando_vistoria`/`liberada_para_assinatura` → `monitoramento`; demais → `cadastro`.
  - Vendedor/agência sem papel de back-office → modo `readonly` (novo): apenas visualização, sem botões de aprovar/reprovar/etapa.
- Adicionar suporte a `modo="readonly"` em `ModalDetalhesTroca`:
  - Esconder bloco de ações (aprovar, reprovar, solicitar vistoria, reenviar termo).
  - Manter visíveis: dados do veículo, partes, timeline de aprovação, status do termo, status do contrato, link para a cotação, mini-card de vistoria (item 4).
- Esconder ou desabilitar sub-abas que não façam sentido para o setor:
  - Analista de Cadastro: pode ver todas, mas só aprova "Aguardando Cadastro".
  - Analista/Coordenador de Monitoramento: pode ver todas, mas só aprova "Aguardando Monit." e "Em Vistoria".
  - Não vamos esconder abas — manter visibilidade plena, e quem decide a ação é o `modo` repassado ao modal (mais simples e menos confuso).

### 3. Card de Saúde SGA em Cadastro › Processos › Titularidade › "Aprovadas"

Adicionar logo acima da lista, na sub-aba `aprovadas`:

- **Cards agregados** (3 mini-cards lado a lado):
  - Trocas efetivadas com `sga_status = 'sucesso'` (verde).
  - Pendentes de SGA (`sga_status` null/`processando` ou ainda em `liberada_para_assinatura` aguardando contrato) — amarelo.
  - Erros (`sga_status = 'erro'`) — vermelho. Clicar expande lista filtrada.
- Em cada item da lista (quando `sga_status = 'erro'`): badge vermelho "Erro SGA" + botão "Tentar novamente" que chama `efetivar-troca-titularidade` em modo retry; tooltip exibe `sga_erro`.
- Acesso restrito: só renderiza para `isAnalistaCadastro || canSeeAll` (esconde para vendedores).

> Observação: a fila SGA já existe em outro lugar (Cadastro › Fila do SGA). Aqui só replicamos o status restrito a trocas — link "Ver fila completa do SGA" no rodapé do card aponta pra essa página existente.

### 4. Mini-card de Vistoria dentro do `ModalDetalhesTroca`

Quando `solicitacao.servico_vistoria_id` existir, renderizar um bloco entre Timeline e Termo:

- Título "Vistoria do veículo".
- Buscar `servicos` pelo id (`status`, `tipo_servico`, `agendamento_data`, `instalador_id`, `concluido_em`) + última vistoria associada (fotos, status final).
- Mostrar status do serviço com badge colorido + datas + nome do instalador.
- Botão "Abrir vistoria" → navega para `/monitoramento/vistorias/{id}` (rota existente) em nova aba.
- Visível em todos os modos (cadastro, monitoramento, readonly).

---

## Detalhes técnicos

**Arquivos editados**:
- `src/pages/cadastro/ProcessosOperacionais.tsx`:
  - Substituir `scopeToSelf = permissions.isVendedorOnly` pela regra `canSeeAll`.
  - Repassar `modo` calculado para `TrocaTitularidadeTab`.
  - `TrocaTitularidadeTab`: aceitar `modoFixo?: 'cadastro' | 'monitoramento' | 'readonly'`; quando ausente, derivar por status no momento de abrir o modal.
  - Adicionar `<SaudeSgaTrocas>` no topo da sub-aba `aprovadas` (componente novo, ver abaixo).

- `src/components/troca-titularidade/ModalDetalhesTroca.tsx`:
  - Estender prop `modo` para incluir `'readonly'`.
  - Esconder painel de ações quando `modo === 'readonly'`.
  - Sempre renderizar `<MiniCardVistoriaTroca>` quando `servico_vistoria_id`.

- `src/components/troca-titularidade/MiniCardVistoriaTroca.tsx` (novo): hook próprio com `useQuery` em `servicos` + `vistorias`.

- `src/components/troca-titularidade/SaudeSgaTrocas.tsx` (novo): consulta `solicitacoes_troca_titularidade` filtrando `status in (liberada_para_assinatura, efetivada)`, agrega por `sga_status`, expõe botão de retry chamando `supabase.functions.invoke('efetivar-troca-titularidade', { body: { solicitacao_id, retry: true } })`.

- `supabase/functions/efetivar-troca-titularidade/index.ts`: aceitar payload `{ solicitacao_id, retry: true }` que reexecuta apenas a etapa SGA quando a troca já está `efetivada` mas `sga_status='erro'`. Idempotente.

**Sem migração de banco** — `sga_status` e `sga_erro` já existem em `solicitacoes_troca_titularidade` (vide referência no resumo da etapa anterior). Confirmar com `supabase--read_query` no momento da implementação.

**Nada de alteração de RLS** — o filtro `criado_por` é do lado da query.