---
name: Termo de Substituição — placa anterior canônica
description: Rótulo "cobertura cancelada" usa {{substituicao.placa_anterior}}; nunca {{veiculo.placa}}; fonte em cascata
type: feature
---
No template `documento_templates` codigo='SUB' (is_default_substituicao=true), o rótulo "(o veíc. terá a cob. do PSM cancelada)" **deve sempre ser seguido por `{{substituicao.placa_anterior}}`**, NUNCA `{{veiculo.placa}}` — `veiculo.placa` resolve para `contratos.veiculo_placa`, que é sempre o veículo NOVO em substituições, gerando inversão antigo↔novo no termo.

**Fonte canônica em cascata para `templateData.substituicao` (usada em `autentique-create` e `autentique-create-by-token`):**
1. `substituicoes_veiculo` (matched por `associado_id`+`veiculo_novo_id`) — fonte preferencial mas materializada SÓ no `efetivar-substituicao` (pós retirada+instalação). Para emissão inicial do termo está sempre vazia.
2. `cotacoes.dados_extras.veiculo_antigo_placa` / `veiculo_antigo_modelo` / `veiculo_antigo_fipe` — gravados na criação da cotação de substituição.
3. `solicitacoes_substituicao_placa` (matched por `dados_extras.solicitacao_substituicao_id` OU `cotacao_id`) — `veiculo_antigo_placa` + `veiculo_antigo_snapshot.modelo` / `.valor_fipe`.
4. `veiculos` via `solicitacoes_substituicao_placa.veiculo_antigo_id` (best-effort para completar `marca+modelo` e `valor_fipe`).

**Defesa em profundidade em `_shared/template-utils.ts`:** quando `dados.substituicao` é `undefined`, popular explicitamente `substituicao.placa_anterior`/`modelo_anterior`/`fipe_anterior` como `—`, evitando warning de "variável não substituída" e mantendo saída legível.

Front (`SubstituicaoStatusCard`, `StepConclusao`, `AgendamentoSubstituicaoSeparado`, `EtapaAssinaturaSubstituicao`) lê direto `veiculo_antigo_*`/`veiculo_novo_*` de `substituicoes_veiculo` — sem inversão.

Sanado em 10/06/2026 (caso CTR-20260606172721-Q70HEK / Patrick Farias / RJN2A96→LTP7C50).
