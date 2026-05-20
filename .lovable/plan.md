# Flag pulsante de "passo travado" nas cotações do consultor

## Objetivo
Quando o associado **já assinou o termo** e fica muito tempo parado em um passo (ou abandona um passo), exibir um **badge pulsante** ao lado da cotação na lista do consultor, sinalizando que falta intervenção. Hoje o consultor não tem como saber, sem abrir cada cotação, que o cliente travou no fluxo.

## Escopo (UI/lógica de apresentação)
Apenas frontend + um helper compartilhado. Sem mudanças de DB e sem mexer no fluxo canônico (Cadastro/Monitoramento/Ativação seguem iguais — esta é só uma sinalização visual para o vendedor).

Telas afetadas:
- `src/pages/vendas/Cotacoes.tsx` (lista principal)
- `src/components/cotacoes/CotacoesTable.tsx` (desktop)
- `src/components/cotacoes/CotacoesMobileList.tsx` (mobile)
- `src/components/cotacoes/CotacaoVendedor.tsx` (card de detalhe)
- `src/components/vendas/FollowupWidget.tsx` (dashboard do vendedor)

## Regras de "travado" (quando o badge acende)
Pré-requisito **obrigatório**: o contrato precisa estar `assinado` ou `ativo` (ou seja, `contratos.status IN ('assinado','ativo')`). Antes da assinatura, o consultor já tem o funil normal; o pedido é especificamente sobre **após a assinatura**.

A partir daí, o helper `getCotacaoTravada(cotacao, agora)` retorna `{ travada: boolean, motivo, nivel: 'amarelo'|'vermelho', horasParada }`. SLA por etapa (`getEtapaVenda`):

| Etapa pós-assinatura            | Amarelo (pulsa devagar) | Vermelho (pulsa rápido) |
|---------------------------------|-------------------------|--------------------------|
| `realizando_pagamento`          | > 6h                    | > 24h                    |
| `escolha_vistoria`              | > 12h                   | > 36h                    |
| `realizando_autovistoria`       | > 12h                   | > 48h                    |
| `aguardando_vistoria`           | > 24h                   | > 48h *(toca regra dos 48h de suspensão de cobertura — já é o limite operacional)* |
| `vistoria_agendada` / `instalacao_agendada` (data no passado, sem conclusão) | imediato | > 24h após data agendada |

Estados que **não** acendem o badge: `em_analise`, `associado_ativo`, `vistoria_realizada`, `veiculo_recusado`, `cancelado` — nesses casos a bola está fora do cliente.

### Fonte do "tempo no passo atual"
Usar `cotacoes_publicas_historico`: `MAX(created_at) WHERE cotacao_id = X AND status_novo IS NOT NULL`. Fallback para `cotacoes.updated_at` quando não houver histórico.

A query é incluída no hook que já carrega a lista (`useCotacoes`) via um JOIN leve `last_step_at` para não gerar N+1.

## UI do badge
- Componente novo `src/components/cotacoes/FlagTravada.tsx`.
- Visual: bolinha pulsante (`animate-ping` + dot estático) ao lado do badge de etapa já existente. Amarelo = `bg-amber-500`, vermelho = `bg-red-500`. Respeita `prefers-reduced-motion` (vira dot estático).
- Tooltip ao hover: motivo + tempo parado (ex.: *"Cliente parado em 'Realizando Pagamento' há 9h"*).
- Acessibilidade: `role="status"` + `aria-label` descritivo.

## Filtro e contagem
- Em `Cotacoes.tsx`, adicionar chip de filtro "Travadas" (amarelo + vermelho) e contador no header da aba.
- Em `FollowupWidget.tsx`, novo card "Travadas pós-assinatura" listando as cotações vermelhas do consultor logado, ordenadas por `horasParada` desc.

## Escopo de visibilidade
Reaproveitar a regra atual: vendedor não-gestor vê só as suas (`vendedor_id = profile.id`); gestor/diretor vê todas. Nada novo aqui.

## Arquivos a criar/alterar
- **Novo:** `src/lib/cotacaoTravada.ts` — função pura `getCotacaoTravada` + tabela de SLA.
- **Novo:** `src/components/cotacoes/FlagTravada.tsx` — badge pulsante + tooltip.
- **Alterar:** `src/hooks/useCotacoes.ts` — trazer `ultimo_passo_em` (subquery em `cotacoes_publicas_historico`).
- **Alterar:** `CotacoesTable.tsx`, `CotacoesMobileList.tsx`, `CotacaoVendedor.tsx` — renderizar `<FlagTravada/>` ao lado do badge de etapa.
- **Alterar:** `Cotacoes.tsx` — chip de filtro "Travadas" + contador.
- **Alterar:** `FollowupWidget.tsx` — seção "Travadas pós-assinatura".

## Detalhes técnicos
- Sem migração SQL — `cotacoes_publicas_historico` já tem `status_novo` + `created_at`.
- Cálculo client-side com `Date.now()`; recálculo a cada 60s via `useEffect` + `setInterval` no nível da página (não por linha) para evitar re-render em massa.
- Sem websocket dedicado: o realtime de `cotacoes` que já existe (`useContratosRealtime`/refetch) cobre updates de status.
- Sem alteração de regras de negócio: o badge é puramente informativo, não bloqueia nem move a cotação.

## Fora de escopo (proposital)
- Notificações por WhatsApp/email — pode ser uma fase 2 plugando no mesmo helper.
- Reabertura automática de etapas / nudge ao cliente — fase 2.
- SLA configurável por usuário no painel — começamos com os valores acima fixos; se virar demanda, viramos tabela.
