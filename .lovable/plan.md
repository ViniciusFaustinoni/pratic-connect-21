## Objetivo

Depois que a cotação de Substituição é gerada (via `CotacaoFormDialog` com `origemSubstituicao`), o link público já segue o caminho canônico (plano → termo Autentique → autovistoria/agendamento → pagamento). A única diferença em relação a uma cotação comum é **na hora do agendamento**:

- Hoje: cria 1 serviço (instalação do veículo novo).
- Alvo: criar **2 serviços de campo** no mesmo agendamento_base:
  1. `instalacao` para o **veículo novo** (fluxo idêntico ao atual).
  2. `vistoria_retirada` para o **veículo antigo** (retirada do rastreador).

O resto (fila de Monitoramento, aprovação administrativa, conclusão da instalação) permanece igual — o serviço de retirada já é um tipo existente (`vistoria_retirada`, com edges `concluir-retirada` / `processar-pos-retirada` em produção).

## Mudanças

### 1. `supabase/functions/criar-instalacao-pos-pagamento/index.ts`

Após materializar a instalação + serviço `instalacao` do veículo novo, detectar substituição e enfileirar a retirada do antigo:

- Ler `cotacoes.dados_extras.solicitacao_substituicao_id` (e/ou `tipo_entrada='substituicao_placa'`).
- Carregar `solicitacoes_substituicao_placa` → obter `veiculo_antigo_id`, `associado_id`, snapshot da placa antiga.
- Criar 1 serviço extra:
  - `tipo='vistoria_retirada'`
  - `veiculo_id = veiculo_antigo_id`
  - `associado_id`, `contrato_id` (antigo, se houver), `cotacao_id` (a nova)
  - `agendamento_base_id` = mesmo da instalação (mesma visita do técnico)
  - `status='agendada'`, `data_agendamento` = mesma da instalação
  - `origem='substituicao_placa'`, `instalacao_origem_id`/`vistoria_origem_id` nulos
- Idempotência: checar se já existe `servicos` `vistoria_retirada` ativo para `(veiculo_antigo_id, agendamento_base_id)` antes de inserir (mesmo padrão da instalação).
- Logging via `insertAuditLog` com `acao='criar'` e descrição `[substituicao] serviço de retirada criado`.

### 2. UI — sem mudanças estruturais

- Fila Serviços de Campo, Atribuição Manual, Monitoramento e link do prestador já tratam `vistoria_retirada` (já que retirada avulsa existe). Apenas verificar visualmente após o build que os 2 serviços aparecem como itens distintos do mesmo agendamento.
- `useServicosCampoUnificado` agrupa por (associado+veiculo); retirada ficará num grupo separado (veículo antigo), instalação no grupo do veículo novo — comportamento desejado.

### 3. Pós-conclusão

- Instalação concluída segue caminho canônico (Monitoramento aprova → `ativar-associado`).
- Retirada concluída já dispara `processar-pos-retirada` (desvincula rastreador do veículo antigo) — sem alterações.
- `efetivar-substituicao` continua sendo o passo de cancelamento do veículo antigo após aprovação administrativa — não muda neste escopo.

## Fora de escopo

- Nenhuma alteração em `efetivar-substituicao`, `aprovar-proposta`, fila de Monitoramento, `concluir-retirada`, `processar-pos-retirada` ou banco.
- Nenhuma mudança no fluxo público (`CotacaoContratacao`) — já é canônico.
- Nenhuma migração de schema (tipos e colunas necessários já existem: `servicos.tipo='vistoria_retirada'`, `origem`, `agendamento_base_id`).

## Riscos / pontos de atenção

- **Idempotência**: `criar-instalacao-pos-pagamento` é chamada por vários gatilhos (asaas-webhook, aprovar-proposta, agendar-vistoria-*). O bloco novo precisa do mesmo `INSERT ... ON CONFLICT`/pré-check usado para a instalação, senão geramos múltiplas retiradas.
- **Veículo antigo sem rastreador físico**: se `solicitacao_substituicao.veiculo_antigo_id` aponta para veículo que dispensa rastreador, **não** criar retirada (não há o que retirar). Critério: existir `rastreadores` vinculado a `veiculo_antigo_id`.
- **Data**: usar exatamente a `data_agendamento` da instalação — não default `hoje` (regra canônica `instalacao-data-agendada-source`).
