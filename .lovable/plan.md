
## Caso analisado (anexo — INS-2026-00076 / placa LTG3H67)

- Instalação: id `82b36ad6…`, status `atribuida`, data `27/04/2026` (período manhã), técnico `Rafael Peixoto` (`a2c2f6ca…`).
- Serviço vinculado: id `20810068…`, tipo `instalacao`, status `agendada`, mesmo `profissional_id`. Já houve uma "liberação" anterior (observação: `[28/04/2026 09:33] LIBERADO PELO ADMIN: vai fazer hj`) — porém o serviço continua `agendada` no técnico, com data 27/04 já vencida.
- Hoje é 28/04/2026 → o associado passou do horário/não compareceu, mas o coordenador na aba "Atribuição Manual" não consegue agir: o serviço não aparece na fila de pendentes (porque já tem `profissional_id`) e o card do técnico só mostra a tarefa, sem ação.

## Causa raiz

1. **Atribuição Manual só lê serviços "livres"**  
   `useServicosParaAtribuir` filtra `is('profissional_id', null)`. Tudo o que já foi atribuído some da fila — não há como o coordenador interagir com isso na própria aba.

2. **Card do técnico (DroppableVistoriador) não tem ações**  
   Renderiza só badge/status. Não há botão para "Liberar", "Reatribuir" ou "Marcar não compareceu". O coordenador é forçado a sair do fluxo.

3. **Única ferramenta existente (`liberar_servico_admin`) cancela o serviço**  
   A RPC marca `servicos.status='cancelada'`, fecha `agendamentos_base`, mas **não toca em `instalacoes`** (continua `atribuida`) e descarta a instalação — não reagenda. Útil quando "já foi feito mas travou", inadequado para "não compareceu, quero reatribuir".

4. **Não existe operação intermediária "marcar não compareceu / devolver à fila"**  
   Não há RPC nem UI para preservar a instalação, limpar `profissional_id` e devolver à fila de atribuição manual com novo período/data.

5. **Dessincronia `servicos` ↔ `instalacoes`**  
   No caso do anexo, `servicos.observacoes` registra "LIBERADO PELO ADMIN" mas `servicos.status` continua `agendada` e a `instalacoes` continua `atribuida` — provavelmente uma liberação anterior falhou parcialmente (transação não atômica entre as duas tabelas).

## Solução (raiz)

Introduzir uma operação canônica e segura **"marcar como não realizada e devolver à fila"** + **"reatribuir direto a outro técnico"**, expostas dentro da própria aba "Atribuição Manual" e no modal de detalhe do serviço. Sem alterar nenhum fluxo do técnico/instalador.

### 1. Nova RPC `liberar_servico_para_reatribuicao` (não destrutiva)

Diferente da `liberar_servico_admin` (que cancela), esta:
- Exige motivo + categoria (`nao_compareceu` | `tecnico_indisponivel` | `outro`).
- Mantém `servicos` ativo: zera `profissional_id`, `iniciada_em`, `em_rota_em`, `confirmacao_whatsapp`; aplica novo `data_agendada` e `periodo` (default = hoje, manhã); status volta para `agendada`/`pendente` conforme parâmetro.
- Sincroniza `instalacoes` correspondente (via `instalacao_origem_id`): `instalador_responsavel_id=null`, `status='pendente'`, atualiza `data_agendada`/`periodo`, registra em `historico_datas`.
- Sincroniza `vistorias` (via `vistoria_origem_id`) com a mesma data/período.
- Fecha qualquer `agendamentos_base` ativo da mesma `instalacao_id` (para não duplicar — segue regra "uma origem = um agendamento ativo").
- Registra em `associados_historico` (tipo `status_alterado`, ação `devolvida_fila`) e em `servicos_atribuicoes_log` (`tipo_atribuicao='liberacao_para_fila'`).
- Mesma autorização de hoje: `diretor`, `admin_master`, `desenvolvedor`, `coordenador_monitoramento` — adicionar também `analista_monitoramento` conforme pedido do usuário.
- Tudo dentro de uma única transação (atômico) para não repetir o problema do estado inconsistente atual.

### 2. Nova RPC `reatribuir_servico_admin`

Wrapper que: chama internamente a lógica de #1 e em seguida grava o novo `profissional_id` + log `tipo_atribuicao='reatribuicao_manual'`. Usado quando o coordenador já sabe para quem mandar.

### 3. UI — Aba "Atribuição Manual"

a) **Card do técnico (`DroppableVistoriador`)** — adicionar menu de 3 pontinhos em cada tarefa listada com:
   - "Marcar não compareceu / devolver à fila" → abre dialog (motivo + nova data/período) → chama `liberar_servico_para_reatribuicao`.
   - "Reatribuir a outro técnico" → permite arrastar para outro card; ou abre seletor — chama `reatribuir_servico_admin`.

b) **Nova seção colapsável "Travados / Atribuídos"** acima das rotas, listando todos os serviços com `profissional_id IS NOT NULL` e `status IN ('agendada','em_rota','em_andamento')` cujo `data_agendada < hoje` OU cuja janela do período já passou. Mostra alerta visual e os mesmos dois botões.

c) **Hook auxiliar** `useServicosTravados` — query separada (não mistura com `useServicosParaAtribuir`, para não quebrar o filtro existente do drag-and-drop).

### 4. UI — `ServicoDetailModal` (aba Serviços)

- Adicionar botão "Devolver à fila / reatribuir" ao lado do já existente "Liberar serviço". Os dois coexistem com finalidades distintas:
   - **Liberar serviço**: cancela definitivamente (uso atual, casos onde já foi feito offline).
   - **Devolver à fila**: preserva e reagenda (novo).

### 5. Garantia de não regressão

- Nenhuma alteração nos fluxos do app do instalador / vistoriador (executar, fotos, checklist, conclusão).
- Nenhuma alteração nas máquinas de estado existentes — só novas transições de saída controladas pela nova RPC.
- Trigger `trg_sync_agendamento_base_on_servico_terminal` continua válida (a nova RPC fecha o `agendamentos_base` explicitamente antes de criar nova fila).
- Reaproveita a infraestrutura de `associados_historico` e `servicos_atribuicoes_log` (já mapeados na timeline).

## Detalhes técnicos resumidos

- Migração SQL com as duas novas RPCs (`SECURITY DEFINER`, search_path `public`).
- Atualizar `useAtribuicaoManual.ts`: novo hook `useDevolverServicoParaFila` + `useReatribuirServico`.
- Atualizar `AtribuicaoManualTab.tsx`: menu de ações no card do técnico + seção "Travados/Atribuídos".
- Atualizar `ServicoDetailModal.tsx`: novo botão "Devolver à fila".
- Adicionar mapeamento dos novos tipos de evento na timeline (`useAssociadoHistoricoCompleto.ts` e `TimelineHistorico.tsx`) — `devolvida_fila`, `reatribuida_manual`.

## Para o caso específico do anexo

Após o deploy, com 1 clique no card do Rafael Peixoto na aba "Atribuição Manual":
- "Devolver à fila" com motivo "Cliente não compareceu" e nova data 28/04 manhã → o serviço volta para a coluna esquerda, instalação fica `pendente`, técnico desbloqueado, agendamento_base anterior fechado, histórico do associado registrado. Coordenador pode então arrastar para outro técnico ou aguardar a próxima rota.
