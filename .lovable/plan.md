## Diagnóstico cruzado (logs + payloads)

**Universo afetado:** 1 contrato `tipo_entrada='substituicao_placa'` em produção (CTR-20260606172721-Q70HEK / Patrick) — feature recém-ativada, blast radius pequeno mas o bug é universal: qualquer substituição futura cairia no mesmo template invertido.

**Bug primário (template SUB — id `5802464d`):**
```
{{operacao.substituicao_placa}} Subs. Placa
  (o veíc. terá a cob. do PSM cancelada) {{veiculo.placa}}
```
- `{{veiculo.placa}}` resolve para `contrato.veiculo_placa` em `termo-afiliacao-utils.ts:460` → sempre o **veículo NOVO** (LTP7C50).
- O rótulo descreve por definição o **veículo ANTIGO** (RJN2A96).
- Curiosamente o MESMO template já usa `{{substituicao.placa_anterior}}` corretamente num bloco mais à frente (pos 10078: *"substitui integralmente a proteção anteriormente vigente sobre o veículo de placa {{substituicao.placa_anterior}}…"*). A linha do cabeçalho ficou esquecida.

**Bug secundário (popular `substituicao.placa_anterior`):** em `autentique-create/index.ts:611-628` o objeto `templateData.substituicao` só é populado quando existe linha em `substituicoes_veiculo` com `veiculo_novo_id = contrato.veiculo_id`. Mas essa linha **só nasce no `efetivar-substituicao`** (após retirada+instalação concluídas). O termo é emitido MUITO antes disso (assinatura no link público), então `templateData.substituicao` **sempre estará `undefined` no momento da geração**. Resultado: o engine `limparVariaveisNaoSubstituidas` substitui `{{substituicao.placa_anterior}}` por `—`. Para o Patrick, o bloco grande do meio do termo já saiu com `— (—)`.

**Fonte canônica disponível desde o início do fluxo (e ignorada):**
- `solicitacoes_substituicao_placa` (criada no clique inicial) — tem `veiculo_antigo_id`, `veiculo_antigo_placa`, `veiculo_antigo_snapshot`.
- `cotacoes.dados_extras.veiculo_antigo_id` / `veiculo_antigo_placa` / `veiculo_antigo_modelo` / `solicitacao_substituicao_id` (já gravado em todo cotação de substituição).
- Conferido para Patrick — ambos populados corretamente.

**Front (UI) — sem inversão.** `SubstituicaoStatusCard`, `StepConclusao`, `AgendamentoSubstituicaoSeparado` e `EtapaAssinaturaSubstituicao` leem `veiculo_antigo_*` / `veiculo_novo_*` corretamente.

---

## Plano (raiz primeiro, saneamento depois)

### Fase 1 — Corrigir a raiz

**1.1 Corrigir template SUB (DB)**
Migração idempotente trocando exatamente:
```
PSM cancelada) {{veiculo.placa}}
```
por
```
PSM cancelada) {{substituicao.placa_anterior}}
```
Apenas essa ocorrência (uso de `REPLACE` literal). Sem mexer no resto do template nem em outros templates.

**1.2 Popular `substituicao.placa_anterior` desde o início do fluxo**
Em `autentique-create/index.ts` (e gêmeo `autentique-create-by-token`), após o bloco atual (linha 611):
- Se `templateData.substituicao` continuar `undefined` E o contrato for `substituicao_placa`/`substituicao`, buscar fallback em CASCATA:
  1. `cotacoes.dados_extras` → `veiculo_antigo_placa` + `veiculo_antigo_modelo` (+ `veiculo_antigo_fipe` se houver).
  2. Se faltar algo, ler `solicitacoes_substituicao_placa` (via `dados_extras.solicitacao_substituicao_id` OU `cotacao_id`) e completar com `veiculo_antigo_placa`/`veiculo_antigo_snapshot.modelo`/`.valor_fipe`.
- Popular `templateData.substituicao = { placa_anterior, modelo_anterior, fipe_anterior }`.
- Log estruturado `[autentique-create] fallback substituicao via solicitacao` / `via dados_extras` para observabilidade.

**1.3 Fallback adicional no engine de template** (defesa em profundidade)
Em `template-utils.ts:303-311`, garantir que o branch sem `dados.substituicao` ainda define `substituicao.placa_anterior`/`modelo_anterior`/`fipe_anterior` como `—` em vez de deixar o token ser limpo pelo `limparVariaveisNaoSubstituidas` (que joga warning). Mantém saída limpa quando faltar dado de verdade.

**1.4 Memória**
Criar `mem://logic/documents/termo-substituicao-placa-anterior-canonico` resumindo: rótulo "cobertura cancelada" usa `{{substituicao.placa_anterior}}`; nunca `{{veiculo.placa}}`; fonte de dado em cascata cotacoes.dados_extras → solicitacoes_substituicao_placa → substituicoes_veiculo; substituicoes_veiculo só nasce no efetivar, então NÃO pode ser fonte única.

### Fase 2 — Saneamento pontual (depois da Fase 1 estar deployada)

**2.1 Re-emitir o termo do Patrick** via `retificar-termo-filiacao` (já existe — gera v2 versionada).
- Payload: `contrato_id=6786afcc-…`, motivo `"correção de inversão antigo↔novo no rótulo de cobertura cancelada"`.
- Validação: regerar localmente antes, conferir que cabeçalho mostra `RJN2A96` e bloco grande mostra `RJN2A96 (RENAULT DUSTER ZEN 1.6 16V FLEX MEC.)`.
- Confirmar com o operador antes de enviar a re-assinatura ao cliente.

**2.2 Smoke test** — abrir o link público de uma cotação de substituição em ambiente, baixar o PDF preview do termo e validar visualmente os dois pontos.

---

### Detalhes técnicos
- Arquivos: migration em `supabase/migrations/`, `supabase/functions/autentique-create/index.ts`, `supabase/functions/autentique-create-by-token/index.ts`, `supabase/functions/_shared/template-utils.ts`.
- Sem mudança de schema. Sem mexer em `efetivar-substituicao` / `criar-substituicao-agendamentos-separados` / `enviar-termo-cancelamento-substituicao` (todos auditados, sem inversão).
- Sem mudança de comportamento para adesão / troca / migração / inclusão / reativação.
- Idempotência: migração SQL roda `REPLACE` literal — se a string já não existir, não faz nada.

Confirma a Fase 1 (raiz) que eu sigo direto pra implementação, e a Fase 2 (Patrick) eu deixo pra depois sob seu OK?
