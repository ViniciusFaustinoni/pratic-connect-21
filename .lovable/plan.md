## Revisão profunda dos fluxos de cotação

Auditei o código atual contra a regra mestra das 8 etapas e contra cada fluxo derivado (Comum, Troca, Sub-FIPE, Substituição). Abaixo, gaps identificados e correções propostas — agrupados por fluxo, com ordem de execução e arquivos impactados.

---

### Princípio invariante (vale para TODOS os fluxos)

```
link público → CADASTRO (manual) → gera serviço de campo → MONITORAMENTO (atribui) → vistoria (ou não) → MONITORAMENTO aprova → ativar-associado → SGA
```

- Cadastro **sempre manual**. Trigger `trg_protege_cadastro_aprovado` impede regressão, mas hoje há atalhos que materializam serviço/instalação **antes** do Cadastro aprovar — o que viola a etapa 3.
- `ativar-associado` é o único caminho para `status='ativo'`.

---

### FLUXO 1 — Cotação comum

**Gaps encontrados**
1. `finalizar-autovistoria-cotacao` cria `servicos.vistoria_entrada` com status `concluida` direto para FIPE ≥ R$ 30k, **antes** do Cadastro aprovar. Para sub-FIPE já nasce `em_analise` (correto). Comum precisa do mesmo tratamento.
2. `criar-instalacao-pos-pagamento` é chamado pelo `aprovar-proposta` no momento certo, mas há paths de fallback que disparam antes do flag `cadastro_aprovado=true`.
3. Migration `20260515140337` (auto-promove cadastro pós-operacional) **mascara o defeito**: deve ser convertida em alerta/auditoria, não em promoção automática (a promoção só acontece quando o Cadastro clica aprovar).

**Correções**
- `finalizar-autovistoria-cotacao`: `servicoStatusInicial = 'em_analise'` para todos os casos (não só sub-FIPE). O serviço só vira `concluida` quando o Cadastro aprovar.
- `aprovar-proposta`: ao aprovar Cadastro, fazer transição atômica `em_analise → concluida` no serviço de vistoria_entrada existente, antes de promover para Monitoramento.
- Substituir trigger `fn_auto_promover_cadastro_pos_operacao` por uma versão que **apenas registra alerta** em `logs_auditoria` (`gravidade='warning'`) sem alterar `cadastro_aprovado`.
- Backfill: contratos hoje aprovados pelo trigger ficam como estão (auditoria já existe).

---

### FLUXO 2 — Troca de Titularidade

**Gaps encontrados**
1. Memória `troca-cadastro-sempre-manual` está correta e o código de `vincular-cotacao-troca` mantém `aguardando_cadastro` — porém o **comentário-cabeçalho** de `aprovar-troca-cadastro/index.ts` ainda diz "FLUXO PADRÃO: o cadastro é AUTO-APROVADO em vincular-cotacao-troca". Documentação desencontrada — precisa ser corrigida (e qualquer caminho residual eliminado).
2. Trigger `trg_promove_para_aguardando_monitoramento` (memória `troca-monitoramento-pos-vistoria`) deve garantir que somente após autovistoria do novo titular **+ aprovação manual do Cadastro** o status vire `aguardando_monitoramento`. Validar.
3. **Janela de meia-noite** existe via `cron-expirar-trocas-titularidade`, mas confirmar que: (a) cancela o link público antigo, (b) cancela a solicitação, (c) força nova adesão (cotação comum) — não troca.
4. Botão "Solicitar manutenção de rastreador" no painel de Monitoramento da troca: já existe a ação `agendar_manutencao` em `aprovar-troca-monitoramento`. Validar que a UI de aprovação expõe o botão.

**Correções**
- Remover/atualizar comentário enganoso em `aprovar-troca-cadastro/index.ts`.
- Auditar todos os pontos que escrevem `status='aguardando_monitoramento'` em `solicitacoes_troca_titularidade` para garantir que só ocorre via `aprovar-troca-cadastro` (clique manual) ou trigger pós-vistoria após aprovação manual prévia.
- Reforçar `cron-expirar-trocas-titularidade`: cancelar Autentique, marcar `link_status='cancelado'`, e disparar evento que oriente o atendente a abrir nova cotação comum.
- UI: garantir botão "Solicitar manutenção de rastreador" no `AprovacaoTrocaMonitoramentoCard`.

---

### FLUXO 3 — FIPE abaixo do mínimo (sub-FIPE)

**Gaps encontrados**
1. Hoje (memória `vistoria-sem-rastreador-flow`) está correto na DB: `em_analise → Cadastro libera R/F → concluida → Monitoramento decide`. ✔
2. **Falta**: quando o Monitoramento decide "precisa vistoria" (somente fotos), o link público **não está se atualizando para a tela de agendamento**. Hoje o link encerra após autovistoria.
3. Edge `aprovar-troca-monitoramento` tem `tipo_vistoria_troca` para troca; precisa equivalente para o fluxo sub-FIPE comum: ação `solicitar_vistoria_tecnico_fotos` que reabre o link público em modo agendamento.

**Correções**
- Criar/ajustar edge `aprovar-monitoramento-cotacao` (ou estender a existente) com ação `solicitar_vistoria_fotos`:
  - reabrir `cotacoes.link_etapa_atual='agendamento_vistoria'`
  - criar `servicos.tipo='vistoria_entrada'` modalidade `tecnica_somente_fotos` em `aguardando_agendamento`
  - notificar associado por WhatsApp (template existente de reagendamento)
- UI pública: adicionar branch no `CotacaoContratacao.tsx` para `link_etapa_atual='agendamento_vistoria'` reaproveitando o componente de agendamento de base/rota.
- Vistoria técnica de fotos: usar `vistorias.tipo='entrada'` modalidade `tecnica_fotos` (sem instalação). Após conclusão, retorna `aguardando_aprovacao_monitoramento` (já existente).

---

### FLUXO 4 — Substituição

**Gaps encontrados (graves — fluxo divergente da regra)**
1. `criar-solicitacao-substituicao` consulta SGA e grava `tem_debito`, mas **não bloqueia** quando há débito. Usuário exige bloqueio total.
2. Hoje a Substituição segue um wizard próprio (`StepBeneficios`, `StepRastreador`, `StepVistoria`...) — usuário exige fluxo **idêntico ao de cotação comum**, apenas marcado como `tipo_entrada='substituicao_placa'`, com nome/email/telefone pré-preenchidos.
3. Falta integração com link público padrão para a substituição (escolha de plano, docs, assinatura, pagamento, vistoria, agendamento) — hoje o wizard interno faz parte disso fora do link.

**Correções**
- `criar-solicitacao-substituicao`: bloquear (HTTP 409 `inadimplencia_substituicao`) quando `sga.tem_debito === true` para o veículo informado. Mensagem clara para a UI.
- Refatorar entrada de Substituição para abrir o `CotacaoFormDialog` padrão (mesmo padrão do `troca-titularidade-cotacao-on-demand`), passando contexto `origemSubstituicao` com:
  - `tipo_entrada='substituicao_placa'`
  - placa antiga + dados do associado SGA (nome/email/telefone) pré-preenchidos
- Após salvar, vincular cotação à `solicitacoes_substituicao_placa` via nova edge `vincular-cotacao-substituicao` (espelho de `vincular-cotacao-troca`), sem alterar status do Cadastro (continua manual).
- Aposentar wizard interno (`StepBeneficios/Rastreador/Vistoria` da substituição) ou marcar como legado para casos antigos. Novo fluxo passa pelas mesmas 8 etapas.
- `efetivar-substituicao` continua sendo o fechador final (após Monitoramento aprovar via `ativar-associado`), incluindo a inativação do veículo antigo no SGA (memória `sga-inativar-veiculo-substituido`).

---

### Detalhes técnicos consolidados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/finalizar-autovistoria-cotacao/index.ts` | `servicoStatusInicial='em_analise'` para todos os casos |
| `supabase/functions/aprovar-proposta/index.ts` | Promover serviço `em_analise→concluida` ao aprovar Cadastro |
| Migration nova | Substituir `fn_auto_promover_cadastro_pos_operacao` por versão **alerta-only** (sem UPDATE) |
| `supabase/functions/aprovar-troca-cadastro/index.ts` | Corrigir comentário-cabeçalho |
| `supabase/functions/cron-expirar-trocas-titularidade/index.ts` | Garantir cancelamento de link Autentique e marcação `link_status='cancelado'` |
| Nova edge `aprovar-monitoramento-cotacao` (ou extensão) | Ação `solicitar_vistoria_fotos` que reabre link público |
| `src/pages/public/CotacaoContratacao.tsx` | Branch para `link_etapa_atual='agendamento_vistoria'` |
| `supabase/functions/criar-solicitacao-substituicao/index.ts` | Bloqueio HTTP 409 quando `tem_debito=true` |
| `src/components/vendas/OutrasEntradasMenu.tsx` + componentes substituição | Substituir wizard próprio por `CotacaoFormDialog` padrão com contexto `origemSubstituicao` |
| Nova edge `vincular-cotacao-substituicao` | Espelho de `vincular-cotacao-troca` |

---

### Validação pós-implementação

Para cada fluxo, rodar end-to-end com a conta director (`admin@teste.com`):
1. Comum (FIPE ≥ 30k, com rastreador) — verificar Cadastro recebe ANTES de qualquer serviço, monitoramento recebe DEPOIS da aprovação manual.
2. Sub-FIPE — pedir vistoria pelo Monitoramento e validar que link público volta para agendamento.
3. Troca — antes de meia-noite (autovistoria → cadastro manual → monitoramento) e depois (link cancelado, exige nova cotação).
4. Substituição — placa com débito (deve bloquear) e sem débito (abre cotação padrão pré-preenchida).

---

### Pergunta de escopo antes de implementar

Posso prosseguir em uma única leva, ou prefere que eu implemente fluxo a fluxo (entregando e validando antes de avançar)? Recomendo fluxo a fluxo na ordem: **(1) Comum → (2) Sub-FIPE → (3) Troca → (4) Substituição**, porque (1) e (2) compartilham a correção da auto-promoção de Cadastro e do reabrir-link.
