## Problema

Na aba **Outros Processos**, quando o titular antigo assina o **termo de cancelamento**, o ícone verde mostra tooltip "Termo assinado" e o badge da etapa fica "Liberada p/ assinatura". Isso confunde, pois ainda falta o **termo de filiação** ser assinado pelo novo associado.

A troca de titularidade tem **dois termos** distintos:
1. Termo de cancelamento — assinado pelo **titular antigo** (campos `termo_cancelamento_*` em `solicitacoes_troca_titularidade`)
2. Termo de filiação — assinado pelo **novo associado** (rastreado via `contratos.assinatura_url` com `origem_troca_titularidade_id`)

Hoje `deriveTermoStatus` e o `TermoIcon` só consideram o cancelamento.

## Mudanças (somente UI/derivação)

### 1. `src/hooks/useOutrosProcessos.ts`
- Adicionar campos no tipo `OutroProcessoItem`:
  - `termo_cancelamento_status` (rebatizar o atual `termo_status`)
  - `termo_filiacao_status: 'nao_aplicavel' | 'pendente' | 'enviado' | 'assinado'`
  - `termo_filiacao_assinado_em: string | null`
- Derivar `termo_filiacao_status` a partir do contrato vinculado (`contratoPorTroca`):
  - sem contrato → `pendente` (após cancelamento assinado) ou `nao_aplicavel` (antes)
  - contrato com `assinatura_url` → `assinado`
  - contrato sem `assinatura_url` mas existe → `enviado`
- Manter compatibilidade: `termo_status` continua representando o cancelamento (alias) para não quebrar `TrocaTimelineDrawer` e ações existentes.

### 2. `src/components/cotacoes/OutrosProcessosPanel.tsx`
- `TermoIcon` passa a renderizar **dois ícones** lado a lado quando aplicável:
  - Cancelamento: tooltip "Termo de cancelamento — assinado/enviado/pendente"
  - Filiação: tooltip "Termo de filiação (novo associado) — pendente/enviado/assinado"
- Quando o cancelamento já está assinado mas a filiação ainda não, o ícone verde de cancelamento mantém-se, e um novo ícone (Clock/Send âmbar) aparece para a filiação com tooltip claro.

### 3. Badge da etapa (`TROCA_STATUS_LABELS` em `useOutrosProcessos.ts`)
- `liberada_para_assinatura` passa a label **"Aguardando termo de filiação"** (tone `info`/`warn`), deixando explícito que falta a assinatura do novo associado.
- Demais labels inalterados.

## Fora de escopo
- Nenhuma mudança em edge functions, schema, lógica de negócio, fluxo de assinatura ou no `TrocaTimelineDrawer` (timeline interna já detalha as etapas corretamente).
- Outros tipos de processo (substituição, inclusão, migração) não são afetados.
