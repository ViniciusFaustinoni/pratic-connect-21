# Bypass de janela de Troca — Cadastro decide, com rastreabilidade total

Reaproveita o modelo do dialog atual. Quando `aprovar-proposta` devolve `JANELA_TROCA_EXPIRADA`, abre o modal com **duas opções**. Ao aprovar com bypass, a informação propaga para Monitoramento, Relacionamento › Análises e `logs_auditoria`.

## 1. Modal do Cadastro (`BypassJanelaTrocaDialog`)

Renomeia o dialog atual e remove o gate de diretor (qualquer Cadastro pode operar).

- **Título:** "Troca fora da janela — escolha como prosseguir"
- **Campos obrigatórios nas DUAS opções:**
  - `nome_autorizador` (text, ≥3 chars) — quem na empresa autorizou
  - `justificativa` (textarea, ≥20 chars)
  - checkbox **"Confirmo que tenho responsabilidade por esta decisão e ela está autorizada por {nome_autorizador}"** (obrigatório marcar)
- **Duas ações:**
  1. **"Aprovar Troca fora da janela"** (âmbar) → `aprovar-troca-cadastro` com `bypass_janela: true`, `bypass_nome_autorizador`, `bypass_justificativa`. Segue como Troca normal.
  2. **"Converter em cotação normal"** (secundário, confirmação extra) → `converter-troca-em-cotacao-normal`. Cancela a Troca; novo interessado refaz como nova adesão.

Gatilho: `PropostaAnalise.tsx` já intercepta `codigo === 'JANELA_TROCA_EXPIRADA'`.

## 2. Edges

**`aprovar-troca-cadastro`** — aceita `bypass_janela`, `bypass_nome_autorizador` (≥3), `bypass_justificativa` (≥20). Sem gate de diretor. Pula o check de janela, grava em `contratos.bypass_aplicado` (jsonb array): `{codigo:'JANELA_TROCA_EXPIRADA', nome_autorizador, justificativa, operador_user_id, operador_nome, aplicado_em}`. Sem flag → mantém 409.

**`converter-troca-em-cotacao-normal`** (nova) — Params `contrato_id`, `nome_autorizador` (≥3), `justificativa` (≥20). Cancela `solicitacoes_troca_titularidade`, cotação/contrato, libera `veiculos.em_troca_titularidade=false`. Idempotente.

## 3. Rastreabilidade canônica (3 destinos)

Em **ambos** os caminhos (bypass aprovado OU conversão), a edge grava:

**A. `logs_auditoria`** — `acao='criar'`, prefixo `[TROCA_BYPASS_JANELA]` ou `[TROCA_CONVERTIDA_EM_COTACAO]`, payload contendo `nome_autorizador`, `justificativa`, `operador_user_id`, `operador_nome`, `contrato_id`, `solicitacao_troca_id`. Passa pelo helper `insertAuditLog` (vigia universal).

**B. `analises_relacionamento`** — insere via `fn_criar_analise_relacionamento` (4º gatilho canônico, somando-se aos 3 já documentados em `mem://logic/operations/analises-relacionamento-ingestao`):
- `tipo`: `bypass_janela_troca` ou `troca_convertida_cotacao`
- `dados`: `{nome_autorizador, justificativa, operador, contrato_id, placa, associado_id}`
- Fila Relacionamento › Análises mostra novo chip âmbar "Bypass de janela".

**C. `contratos.bypass_aplicado` (jsonb)** — para alimentar o banner permanente.

## 4. Banner `BypassAplicadoBanner`

Lê `contrato.bypass_aplicado[]`. Visual âmbar, `AlertTriangle`. Mostra: código humanizado, **autorizado por {nome_autorizador}**, operador, data BRT, justificativa.

Renderizado em:
- `PropostaAnalise.tsx` (Cadastro)
- `ModalDetalhesTroca.tsx`
- **`AprovacaoInstalacaoDetalhe.tsx` (Monitoramento)** — destaque no topo, antes do card de ação; legenda no botão Aprovar reforça o aviso
- `AssociadoDetalhe.tsx` (histórico)
- Detalhe da análise em Relacionamento › Análises

## 5. Migração

```sql
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS bypass_aplicado jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_contratos_bypass_aplicado
  ON public.contratos USING gin (bypass_aplicado);
```

Sem alteração de schema em `analises_relacionamento` (campo `dados jsonb` já comporta o payload); apenas extensão dos `tipo` aceitos.

## 6. Memória canônica

- Atualiza `mem://logic/operations/troca-titularidade-janela-mesmo-dia` com a decisão Cadastro-exclusiva + tríade autorizador/justificativa/checkbox.
- Atualiza `mem://logic/operations/analises-relacionamento-ingestao` para registrar o 4º gatilho (bypass + conversão).

## Fora de escopo

Bypass para outros códigos (`documentos_nao_aprovados`, `autovistoria_pendente`, etc.), notificações em tempo real, conversão automática.
