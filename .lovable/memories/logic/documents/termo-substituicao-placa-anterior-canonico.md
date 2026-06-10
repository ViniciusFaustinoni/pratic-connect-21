---
name: Termo de Substituição — placa anterior canônica
description: Termo SUB exibe 2 blocos (VEÍCULO SUBSTITUÍDO × VEÍCULO NOVO); cascade unificado em _shared/substituicao-cascade.ts
type: feature
---
O **Termo de Substituição** (`documento_templates` codigo='SUB', is_default_substituicao=true) DEVE exibir dois blocos visualmente separados:

1. **Cláusula do tipo de operação** (sucessora do antigo "Subs. Placa (...cancelada) {{veiculo.placa}}"):
   > `(X) Subs. Placa — veículo <strong>{{substituicao.placa_anterior}}</strong> ({{substituicao.modelo_anterior}}) terá a cobertura do PSM <strong>cancelada</strong>`
2. **Bloco "VEÍCULO SUBSTITUÍDO (Cobertura Cancelada)"** com tabela de 3 linhas: Placa / Marca-Modelo / Valor FIPE, todos derivados de `{{substituicao.placa_anterior|modelo_anterior|fipe_anterior}}`.
3. **Bloco "VEÍCULO NOVO (Substituto)"** — antigo "DADOS DO VEÍCULO" renomeado SÓ no template SUB (AF1/adesão comum mantém "DADOS DO VEÍCULO").

NUNCA usar `{{veiculo.placa}}` para identificar o veículo "que sai" — `veiculo.placa` resolve para `contratos.veiculo_placa`, que é sempre o NOVO em substituições.

## Cascade canônico (helper compartilhado)

Fonte: `supabase/functions/_shared/substituicao-cascade.ts` exporta `aplicarSubstituicaoNoTemplateData(supabase, contrato, templateData, prefix)` e `resolverSubstituicaoCascade(...)`.

Consumido por **3 edges** (sem duplicar lógica em cada uma):
- `autentique-create` (admin/back-office)
- `autentique-create-by-token` (link público do cliente)
- `retificar-termo-filiacao` (reemissão versionada) — **chama o cascade SEMPRE** E **prioriza `is_default_substituicao` quando `contratos.tipo_entrada IN ('substituicao_placa','substituicao')`** (mesma lógica do autentique-create). Antes da Fase 3 (10/06/2026) caía direto no `is_default_autentique` (AF1), gerando termo de filiação comum sem bloco de veículo substituído — caso Patrick v1/v2.

Ordem de fallback (a primeira que tiver `placa_anterior` vence; campos faltantes são complementados pelas seguintes):
1. `substituicoes_veiculo` (match `associado_id` + `veiculo_novo_id`) — materializada apenas no `efetivar-substituicao`. Vazia para emissão inicial.
2. `cotacoes.dados_extras.veiculo_antigo_placa` / `veiculo_antigo_modelo` / `veiculo_antigo_fipe` — gravado na criação da cotação de substituição.
3. `solicitacoes_substituicao_placa` (via `dados_extras.solicitacao_substituicao_id` OU `cotacao_id`) — usa `veiculo_antigo_snapshot.modelo`/`.valor_fipe`.
4. `veiculos` via `solicitacoes_substituicao_placa.veiculo_antigo_id` (best-effort para completar marca+modelo/FIPE).

## Defesa em profundidade (template-utils)

`_shared/template-utils.ts > construirMapaTokens` sempre popula `substituicao.placa_anterior|modelo_anterior|fipe_anterior` com `—` quando `dados.substituicao` é undefined, evitando warning de "variável não substituída" e mantendo saída legível.

## Front

`SubstituicaoStatusCard`, `StepConclusao`, `AgendamentoSubstituicaoSeparado`, `EtapaAssinaturaSubstituicao` leem direto `veiculo_antigo_*` / `veiculo_novo_*` de `substituicoes_veiculo` — sem inversão.

## Histórico

- **10/06/2026**: Fase 1 (cascade inicial + template trocando `{{veiculo.placa}}` por `{{substituicao.placa_anterior}}` na cláusula). Caso CTR-20260606172721-Q70HEK / Patrick Farias / RJN2A96→LTP7C50.
- **10/06/2026**: Fase 2 — extração do cascade para `_shared/substituicao-cascade.ts`, aplicação em `retificar-termo-filiacao` (root cause da retificação v1 ter saído sem placa anterior), novo bloco "VEÍCULO SUBSTITUÍDO" e renomeação para "VEÍCULO NOVO (Substituto)". Patrick reemitido como retificação v2 (autentique_documento_id `8ee015a20d902d838e69ba377c21cd928e437685fd93188f6`).
