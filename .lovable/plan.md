## Problema

Hoje, no fluxo de Troca de Titularidade, assim que o titular antigo assina o termo de cancelamento, o webhook `autentique-webhook` muda direto `solicitacoes_troca_titularidade.status` para **`aguardando_cadastro`**. Resultado: a solicitação aparece na fila do Cadastro antes do novo titular ter completado o link público (documentos, contrato, autovistoria), e o link mostra "Em análise pelo Cadastro" antes da hora — o que se vê no print do KOU6D37.

## Regra canônica desejada

```
1. Termo enviado ao titular antigo
2. Termo assinado (reconhecimento facial)  ──► LIBERA link público para o novo titular
3. Novo titular completa o link público inteiro
   (Plano → Documentos → Contrato → Autovistoria / Agendamento)
4. Cadastro analisa (mesma régua da nova adesão)
5. Monitoramento decide vistoria / aprova
6. Troca efetivada
```

A solicitação só pode cair na fila do **Cadastro** quando a cotação canônica vinculada atingir o mesmo gatilho que hoje promove uma nova adesão: `cotacoes.status_contratacao = 'aguardando_aprovacao_cadastro'` (via `finalizar-autovistoria-cotacao` para o caminho enxuto, ou via agendamento de vistoria base no caminho técnico).

Carros seguem intactos — a mudança é só **quando** a troca entra no Cadastro, não no que o Cadastro faz.

## Mudanças

### 1. `autentique-webhook` — não pular etapas

`supabase/functions/autentique-webhook/index.ts` (bloco do termo de cancelamento, ~linhas 311-322):

- Trocar `status: 'aguardando_cadastro'` por `status: 'cotacao_em_andamento'` (status já existente no enum).
- Manter tudo o mais que já roda na assinatura: `termo_cancelamento_assinado_em`, marca de `em_troca_titularidade`/cobertura suspensa no veículo, auto-vínculo da cotação canônica.
- Log: "Termo assinado — solicitação liberada para o novo titular completar o link público".

### 2. Trigger DB: promover solicitação ao Cadastro junto com a cotação

Criar trigger `AFTER UPDATE` em `cotacoes` (migration nova): quando `status_contratacao` muda para `aguardando_aprovacao_cadastro` E a cotação tem `origem_troca_titularidade=true`, atualizar a `solicitacoes_troca_titularidade` vinculada (via `dados_extras.solicitacao_troca_id` ou `solicitacoes_troca_titularidade.cotacao_id`) para `status='aguardando_cadastro'` — mas **só se** o status atual for `cotacao_em_andamento` (idempotente, não regride).

Isso garante que os dois caminhos canônicos da nova adesão (autovistoria enxuta concluída ou agendamento de vistoria base) promovam a troca automaticamente, sem duplicar regra.

### 3. `aprovar-troca-cadastro` — guarda extra

`supabase/functions/aprovar-troca-cadastro/index.ts`: rejeitar (HTTP 409 `link_publico_incompleto`) quando a solicitação ainda estiver em `cotacao_em_andamento`. Mensagem clara para o operador: "Novo titular ainda não concluiu o link público".

### 4. Link público — texto correto enquanto novo titular não terminou

`src/pages/public/CotacaoContratacao.tsx`:

- O bloco "Em análise pelo Cadastro" (visto no print) só pode renderizar quando `solicitacaoTroca.status === 'aguardando_cadastro'` (não mais com base apenas em `termo_cancelamento_assinado_em`).
- Enquanto `status === 'cotacao_em_andamento'`, manter o stepper liberado para o novo titular avançar (Docs → Contrato → Vistoria), como já acontece para nova adesão.
- Ajustar `trocaLiberada` para `liberada_para_assinatura | efetivada | (assinado && status !== 'aguardando_cadastro' && !pos-cadastro)` — manter avanço, mas não mostrar "em análise" antecipado.

### 5. Modal de detalhes da troca (`ModalDetalhesTroca`)

Renomear/ajustar o passo da timeline:
- Hoje: "Aprovado pelo Cadastro" fica em curso assim que o termo é assinado.
- Novo: passo intermediário "Novo titular completando link público" (em curso quando `status='cotacao_em_andamento'`), e só depois "Aprovado pelo Cadastro" (em curso quando `status='aguardando_cadastro'`).

### 6. Backfill leve (mesma migration do trigger)

Para solicitações vivas hoje em `aguardando_cadastro` cuja cotação vinculada ainda não atingiu `aguardando_aprovacao_cadastro` (ou nem tem cotação): rebaixar para `cotacao_em_andamento`. Não tocar nas que já estão pós-cadastro (aprovadas, monitoramento, vistoria, efetivada).

### 7. Memória do projeto

Adicionar entrada `mem://logic/operations/troca-titularidade-promocao-cadastro-canonica` documentando a regra: termo assinado → `cotacao_em_andamento`; só vira `aguardando_cadastro` quando a cotação atinge `status_contratacao='aguardando_aprovacao_cadastro'` (trigger). Atualizar `mem://index.md`.

## Fora de escopo

- Fluxo de carros / nova adesão: nada muda.
- `efetivar-troca-titularidade`, `aprovar-troca-monitoramento`, regras de janela mesmo-dia, antibloqueio de placa, suspensão de cobertura — intactos.
- Caso histórico KOU6D37 (já em `aguardando_cadastro` com cotação ainda inicial) será corrigido pelo backfill do passo 6.

## Validação

- Disparar nova troca em ambiente: assinar termo → conferir `status='cotacao_em_andamento'`, link público abre etapa Documentos, NÃO aparece na fila Cadastro/Processos.
- Concluir docs + contrato + autovistoria pelo novo titular → cotação vira `aguardando_aprovacao_cadastro` → trigger promove solicitação para `aguardando_cadastro` → aparece na fila do Cadastro.
- Cadastro aprova → segue para Monitoramento (sem mudanças nesse trecho).