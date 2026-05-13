
# Realinhamento do Fluxo de Troca de Titularidade

## Regra 1 — Expiração à meia-noite

Hoje, depois que o **titular antigo** assina o termo de cancelamento, a troca fica em `aguardando_cadastro` indefinidamente até o novo titular assinar. Nada cancela automaticamente.

**Comportamento desejado:** se o **novo titular não assinar o termo de filiação até 23:59:59 do mesmo dia da assinatura do termo de cancelamento**, o sistema deve:

1. Cancelar a **solicitação de troca** (novo status `expirada` na enum `status_troca`).
2. Cancelar o **veículo do titular antigo** (segue rota normal de cancelamento por baixa do termo já assinado).
3. **Bloquear** assinaturas tardias: mesmo que o novo titular abra o link público de assinatura depois, deve ver tela "Solicitação expirada — entre em contato para uma nova cotação".
4. Se o veículo precisar voltar à carteira, **uma nova venda** (cotação nova) deve ser criada manualmente — a troca expirada não pode ser reaberta.

**Implementação:**
- Nova edge `cron-expirar-trocas-titularidade` (rodando a cada 15 min): seleciona `solicitacoes_troca_titularidade` com `status IN ('aguardando_cadastro','aguardando_monitoramento','aguardando_vistoria','liberada_para_assinatura')` e `termo_cancelamento_assinado_em < (hoje 00:00 BRT)`, e o novo associado/contrato ainda não assinou o termo de filiação. Para cada uma:
  - Atualiza `status='expirada'`, grava `motivo_reprovacao='Prazo de assinatura do novo titular expirado (meia-noite do dia da assinatura do cancelamento).'`
  - Chama edge existente que executa o cancelamento do contrato/veículo do antigo (rota já usada quando o termo de cancelamento é honrado).
  - Marca a `cotacao` vinculada como `cancelada` para impedir continuidade no link público.
- Novo guard no link público de assinatura/contratação da troca: se `solicitacao.status='expirada'`, renderizar tela "Solicitação expirada".
- Agendamento via `pg_cron` (migration: `select cron.schedule('expirar-trocas-titularidade','*/15 * * * *', $$select net.http_post(...edge...)$$)`).

## Regra 2 — Fluxo de aprovação e tipo de vistoria

Hoje o Monitoramento, em `solicitacao.status='aguardando_monitoramento'`, tem dois botões: **Aprovar** (libera assinatura/efetivação) e **Solicitar Vistoria** (deixa em `aguardando_vistoria`, para o **novo titular fazer autovistoria pelo link público**). Não há escolha entre "só fotos" vs "fotos + instalação de rastreador", e não há criação de tarefa de campo de manutenção.

### 2.1 Sequência consolidada

```
Novo associado assina termo de filiação + paga (quando aplicável)
      → status: aguardando_cadastro
Cadastro analisa  → aprovar  → status: aguardando_monitoramento
Monitoramento decide:
  (a) APROVAR DIRETO        → liberada_para_assinatura → efetivar (já existe)
  (b) SOLICITAR VISTORIA    → escolhe modalidade:
        - Somente fotos (31 carro / 15 moto)
        - Fotos + instalação de rastreador
      → status: aguardando_vistoria  (+ tipo_vistoria_troca, instalar_rastreador)
  (c) AGENDAR MANUTENÇÃO DE RASTREADOR (apenas quando o veículo já tem
      rastreador e o monitoramento quer revisão antes de efetivar)
      → cria serviço de campo `vistoria_manutencao` com endereço completo
      → status auxiliar: aguardando_manutencao
```

### 2.2 Novos campos em `solicitacoes_troca_titularidade`

| coluna | tipo | uso |
|---|---|---|
| `tipo_vistoria_troca` | text (`somente_fotos` \| `fotos_com_rastreador` \| `manutencao`) | escolha do monitoramento |
| `instalar_rastreador` | boolean | atalho usado pela vistoria/instalação |
| `servico_manutencao_id` | uuid → `servicos.id` | quando o monitoramento agenda manutenção |
| `expirada_em` | timestamptz | timestamp da expiração automática |

Adicionar `expirada` à enum `status_troca` e estender `aguardando_manutencao`.

### 2.3 UI — `ModalDetalhesTroca` (modo monitoramento)

Substituir o botão único "Solicitar Vistoria" por um **submenu** com 3 opções:

- **Aprovar direto** (já existe)
- **Solicitar vistoria → Somente fotos**
- **Solicitar vistoria → Fotos + instalar rastreador**
- **Agendar manutenção de rastreador** (abre formulário com endereço completo + autocomplete Google + mapa, igual ao usado em `useCriarManutencao`)
- **Reprovar** (já existe)

Ao confirmar:
- Vistoria: persiste `tipo_vistoria_troca` + `instalar_rastreador`, muda status para `aguardando_vistoria`. Dispara template Meta `troca_vistoria_agendada` para associado e vendedor (via `enviar-template-meta`).
- Manutenção: chama `useCriarManutencao` com endereço informado, vincula `servico_manutencao_id`, status → `aguardando_manutencao`. Dispara template Meta `troca_manutencao_agendada`.

### 2.4 Link público do novo titular

`TelaAnaliseTrocaTitularidade` e `useSolicitacaoTrocaPublicaPorCotacao` já reagem a mudanças. Estender:
- Buscar também `tipo_vistoria_troca`, `instalar_rastreador`, `servico_manutencao_id` (+ join com `servicos` para data/período).
- Quando `status='aguardando_vistoria'`: mostrar card "Vistoria agendada" com tipo (Somente fotos OU Fotos + instalação de rastreador) e CTA para o roteiro de fotos do novo titular (já existe — apenas passar a flag `incluiInstalacao`).
- Quando `status='aguardando_manutencao'`: mostrar "Manutenção de rastreador agendada — data/período/endereço".

### 2.5 Execução da vistoria/manutenção e aprovação final

- **Somente fotos:** o novo titular conclui pelo link público (já existe). Ao concluir, dispara o gatilho atual que reabre o botão "Aprovar" no Monitoramento (`vistoriaClienteConcluida=true`).
- **Fotos + rastreador:** o roteiro de fotos do link público é o mesmo, mas o sistema cria também um `servicos` `instalacao` (ou estende o `vistoria_entrada` com `requer_instalacao_rastreador=true`) para o técnico. O Monitoramento só vê o botão "Aprovar" depois que **as duas tarefas** estiverem com `status='concluida'` E aprovadas pelo técnico.
- **Manutenção:** ao técnico finalizar o serviço `vistoria_manutencao`, trigger marca `solicitacao.status` de volta para `aguardando_monitoramento` para aprovação final.

Em todos os casos, a aprovação final do Monitoramento (já existente) chama `ativar-associado` + `efetivar-troca-titularidade`, que **vincula corretamente o veículo ao novo associado** e sincroniza com o SGA (já implementado em `efetivar-troca-titularidade`).

## Detalhes técnicos

**Migrations**
- `ALTER TYPE status_troca ADD VALUE 'expirada'; ADD VALUE 'aguardando_manutencao';`
- `ALTER TABLE solicitacoes_troca_titularidade ADD COLUMN tipo_vistoria_troca text, ADD COLUMN instalar_rastreador boolean DEFAULT false, ADD COLUMN servico_manutencao_id uuid REFERENCES servicos(id), ADD COLUMN expirada_em timestamptz;`
- Trigger `fn_troca_pos_servico_concluido` em `servicos` AFTER UPDATE: quando `servico_manutencao_id` ou `servico_vistoria_id` referencia uma troca e o status vira `concluida/aprovada`, devolve a troca para `aguardando_monitoramento`.
- `pg_cron` job `*/15 * * * *` chamando a edge nova.

**Edges**
- Nova: `cron-expirar-trocas-titularidade` (lista trocas com termo antigo assinado e nenhum termo de filiação assinado até meia-noite, expira e cancela veículo antigo + cotação).
- Atualizar: `aprovar-troca-monitoramento` para aceitar `acao='solicitar_vistoria'` com `payload.tipo_vistoria_troca` e `payload.instalar_rastreador`; nova `acao='agendar_manutencao'` com endereço.
- Atualizar: `efetivar-troca-titularidade` — bloquear se `status='expirada'`.

**Frontend**
- `src/components/troca-titularidade/ModalDetalhesTroca.tsx`: novo submenu de ações + dialog de manutenção (com autocomplete + mapa, reaproveitando componente já usado em `useCriarManutencao`).
- `src/components/troca-titularidade/TelaAnaliseTrocaTitularidade.tsx`: novos estados visuais para `aguardando_vistoria` (com tipo) e `aguardando_manutencao`.
- `src/hooks/useSolicitacoesTroca.ts` e `useSolicitacaoTrocaPublicaPorCotacao`: incluir os novos campos.
- Templates Meta: `troca_vistoria_agendada`, `troca_manutencao_agendada`, `troca_expirada` (usar mecanismo já existente em `enviar-template-meta`).

## Fora de escopo

- Mudanças no fluxo público de cotação inicial da troca (já corrigido em ajustes anteriores).
- Lógica do SGA — `efetivar-troca-titularidade` já cuida de vínculos e inativação do veículo antigo no SGA.
- Cancelamento físico do rastreador antigo quando a troca expira (segue rota padrão de cancelamento de veículo).

## Pontos para confirmar antes de codar

1. **Fuso da meia-noite:** confirmamos que o corte é **23:59:59 BRT** do dia em que o termo de cancelamento foi assinado, certo? (Ex.: assinado 22/05 às 23:50 → novo titular tem só 9 minutos.) Ou queremos um SLA fixo (24h corridas) a partir da assinatura?
2. **Manutenção de rastreador na troca:** o agendamento abre o **mesmo dialog** já usado em "Rastreadores → Agendar Manutenção" (com endereço/data/período/motivo) e é criado como `vistoria_manutencao` no veículo atual da troca?
3. **Notificações Meta:** posso criar 3 novos templates (`troca_vistoria_agendada`, `troca_manutencao_agendada`, `troca_expirada`) ou prefere reaproveitar/ajustar templates existentes?
