## Objetivo

Parar a criação automática da cotação no fluxo de Troca de Titularidade. A cotação só será gerada **manualmente** pelo operador, através de um botão **"Realizar Cotação"** dentro do modal de detalhes da troca, abrindo o cotador padrão já com os dados do veículo (e consulta FIPE) pré-preenchidos.

## Diagnóstico (estado atual)

- `supabase/functions/criar-solicitacao-troca-titularidade/index.ts` cria a `cotacoes` no mesmo INSERT da `solicitacoes_troca_titularidade` (linhas 244-298) — antes mesmo do termo de cancelamento ser enviado/assinado. Isso gera as "cotações fantasma" com etapa "Aguardando termo de filiação" que aparecem na lista.
- `ModalDetalhesTroca.tsx` apenas mostra link "Abrir cotação" quando `solicitacao.cotacao` existe — não há botão para gerar uma nova.
- O fluxo de Substituição já segue o padrão desejado: ao assinar termo, exibe um Card com botão **"Criar Nova Cotação"** que navega para `/vendas/cotador?...params` (ver `ModalDetalhesSubstituicao.tsx`, linhas 49-61 e 162-178). O `Cotacao.tsx` já reconhece `tipo_entrada=substituicao` e `inclusao` e pula a etapa 1 do solicitante.

## Mudanças

### 1. Backend — não criar cotação automaticamente

**`supabase/functions/criar-solicitacao-troca-titularidade/index.ts`**
- Remover o INSERT em `cotacoes` (linhas 244-275).
- INSERT da `solicitacoes_troca_titularidade` passa a usar `cotacao_id: null`.
- Remover do response `cotacao_id` e `cotacao_token` (ou retornar `null`).
- Manter o disparo automático do termo de cancelamento (linhas 300-318).

### 2. Backend — nova edge function `criar-cotacao-troca-titularidade`

Função idempotente que cria a cotação sob demanda quando o operador clica "Realizar Cotação". Recebe `solicitacao_id`, valida que a solicitação existe, está com `termo_cancelamento_assinado_em` preenchido e ainda não tem `cotacao_id`. Carrega `veiculos` (placa, marca, modelo, ano, combustível, cor, codigo_fipe, valor_fipe) + `novo_titular_dados` da solicitação, faz INSERT na `cotacoes` com os campos hoje feitos no `criar-solicitacao-troca-titularidade` e atualiza `solicitacoes_troca_titularidade.cotacao_id`. Retorna `{ cotacao_id, cotacao_token }`. A consulta FIPE atualizada acontece já no cotador (etapa de veículo) ao confirmar — nada além é necessário aqui, já carregamos `codigo_fipe` e `valor_fipe` do veículo de origem.

### 3. Frontend — `Cotacao.tsx` reconhecer `tipo_entrada=troca_titularidade`

- Aceitar `tipo_entrada=troca_titularidade` como mais um caso de `skipEtapa1`.
- Ler params: `solicitacao_troca_id`, `veiculo_id`, dados básicos do veículo (placa, marca, modelo, ano, fipe).
- Pré-preencher os campos do solicitante a partir de `novo_titular_dados` (nome/cpf/email/telefone) — buscando-os via `solicitacoes_troca_titularidade.id` (não pelo associado, já que o novo titular ainda não é associado).
- Pré-preencher o veículo (placa, marca, modelo, ano, combustível, cor) e disparar a busca FIPE no carregamento da etapa 2 — reutilizar o mesmo botão/efeito que já existe no flow padrão.
- No submit final, persistir `dados_extras.tipo_entrada='troca_titularidade'`, `dados_extras.solicitacao_troca_id`, `dados_extras.veiculo_origem_id` e atualizar `solicitacoes_troca_titularidade.cotacao_id` com a cotação criada (ou usar a edge `criar-cotacao-troca-titularidade` antes de redirecionar — ver alternativa abaixo).

### 4. Frontend — `ModalDetalhesTroca.tsx`

- Quando `solicitacao.cotacao_id` for `null`:
  - Esconder o card "Cotação vinculada".
  - Após o card de Termo, exibir um Card "Próximo passo" com botão **"Realizar Cotação"** (ícone `FileText`/`Plus`):
    - **Habilitado** apenas quando `termo_cancelamento_assinado_em` estiver preenchido (status já estará em `aguardando_cadastro`). Antes disso, o botão fica disabled com tooltip "Aguardando assinatura do termo de cancelamento".
    - Ao clicar: chama a edge `criar-cotacao-troca-titularidade` (ou apenas navega passando params se preferirmos criar a cotação dentro do cotador). Recomendado: chamar a edge primeiro para garantir um `cotacao_id` único e evitar duplicação, depois navegar para `/vendas/cotador?cotacao=<id>` (ou `/vendas/cotacoes?cotacao=<id>` para abrir o editor existente da cotação rascunho).
    - Em caso de erro, toast com mensagem.
- Quando `solicitacao.cotacao_id` existir, manter o comportamento atual ("Abrir cotação").
- Ajustar o Alert "Próximo passo" da seção `cotacao_em_andamento` (linhas 111-131) para também mencionar que após assinatura aparece o botão "Realizar Cotação".

### 5. Lista de cotações — filtro

- A lista `Outros Processos` em `Cotacoes.tsx` hoje exibe a cotação rascunho da troca. Como elas deixarão de existir até o operador gerar manualmente, nenhum ajuste no SQL é estritamente necessário. Validar que `useOutrosProcessos` continua mostrando a `solicitacao_troca_titularidade` mesmo sem `cotacao_id` (ele já lê de `solicitacoes_troca_titularidade`, então OK).

## Migração de dados existentes

Solicitações já criadas com `status='cotacao_em_andamento'` + `cotacao_id` preenchido continuam funcionando normalmente (modal mostra "Abrir cotação"). Não tocaremos nelas.

Solicitações novas terão `cotacao_id = NULL` até o operador acionar o botão.

## Fora de escopo

- Mudanças visuais no cotador padrão.
- Alterações no fluxo público (`/cotacao/:token`) ou nas regras de aprovação subsequentes (cadastro/monitoramento já funcionam consumindo `cotacao_id` quando ele existe).
- Renomear/remover a etapa "Aguardando termo de filiação" — ela apenas deixa de aparecer na lista de cotações porque a cotação não nasce mais junto.

## Critérios de aceite

1. Ao criar uma nova solicitação de troca de titularidade, **nenhuma cotação** é criada automaticamente.
2. Termo de cancelamento continua sendo disparado automaticamente para o titular antigo.
3. Após o titular antigo assinar o termo, ao abrir o modal da troca aparece o botão **"Realizar Cotação"**.
4. Clicar no botão abre o cotador padrão com:
   - Solicitante (novo titular) pré-preenchido (nome/cpf/contato).
   - Veículo pré-preenchido (placa, marca, modelo, ano, combustível, cor) e busca FIPE disparada.
5. Concluir a cotação vincula-a à solicitação (`solicitacoes_troca_titularidade.cotacao_id`) e a partir daí o modal exibe "Abrir cotação" como hoje.
6. Trocas antigas (com cotação já criada) continuam funcionando sem regressão.
