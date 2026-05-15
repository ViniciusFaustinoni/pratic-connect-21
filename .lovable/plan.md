# Por que está travado

Estado real do banco para esta troca (KOU6D37 / `06037fb8…`):

| Campo | Valor |
|---|---|
| `solicitacoes_troca_titularidade.status` | `aguardando_cadastro` |
| `termo_cancelamento_assinado_em` | 15/05 19:28 BRT |
| `autovistoria_concluida_em` | NULL |
| `cotacoes.tipo_vistoria` | `agendada_base` (escolhido erradamente no link público) |
| `agendamentos_base` ativo | 1 (18/05) |

Dois pontos travam o Cadastro:

1. **Backend** — `supabase/functions/aprovar-troca-cadastro/index.ts` linhas 93-102 retornam HTTP 400 `AUTOVISTORIA_PENDENTE` se `autovistoria_concluida_em` for NULL.
2. **Frontend** — `src/components/troca-titularidade/ModalDetalhesTroca.tsx` linha 373 desabilita o botão "Aprovar" pela mesma regra.

Mas a regra correta (reafirmada): a troca herda apenas a **proteção/cobertura vigente** do titular antigo dentro da janela de mesmo-dia (até 23:59:59 BRT do dia da assinatura do termo). Isso significa: **autovistoria inicial não é exigida** — o novo titular faz a cotação normalmente, mas pula a etapa de vistoria. O **Monitoramento**, na fase pós-Cadastro, avalia a pontuação do rastreador e decide se pede uma vistoria (só fotos, ou fotos + instalação). Passada a meia-noite, o `cron-expirar-trocas-titularidade` cancela e força nova adesão.

# Fluxo canônico

```text
Termo de cancelamento assinado (titular antigo)
        ↓
Link público (novo titular) — cotação nova
        ↓
  ┌─ DENTRO da janela mesmo-dia ─────────────────────┐
  │ Etapas: docs → assinatura → pagamento → "Em      │
  │ Análise Cadastral". Sem autovistoria, sem        │
  │ agendamento de vistoria.                          │
  └──────────────────────────────────────────────────┘
        ↓
Cadastro aprova MANUALMENTE a documentação
        ↓
Monitoramento (manual) — avalia pontuação do rastreador:
  ├─ Aprova → liberada_para_assinatura → efetivar-troca-titularidade
  ├─ Pede vistoria (só fotos OU fotos+instalação)
  │      → status='aguardando_vistoria'; link público vira "agendamento"
  │      → técnico executa → trigger devolve para aguardando_monitoramento
  └─ Pede manutenção de rastreador (botão já existente)

Se passa de 23:59:59 BRT → cron-expirar-trocas-titularidade
   cancela veículo + invalida link → exige nova adesão.
```

# Plano

## 1. Backend — desbloquear Cadastro na janela mesmo-dia

**`supabase/functions/aprovar-troca-cadastro/index.ts`** (substituir bloco 93-102):

```ts
// Janela de mesmo-dia: até 23:59:59.999 BRT (UTC-3) do dia em que o termo
// de cancelamento foi assinado, autovistoria é DISPENSADA (proteção herdada).
const dispensaAutovistoriaPorJanela = (() => {
  if (!sol.termo_cancelamento_assinado_em) return false;
  const a = new Date(sol.termo_cancelamento_assinado_em);
  // Fim do dia BRT em UTC = 02:59:59.999 do dia seguinte UTC
  const fimDiaBRTemUTC = new Date(Date.UTC(
    a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(),
    26, 59, 59, 999
  ));
  return new Date() <= fimDiaBRTemUTC;
})();

if (!sol.autovistoria_concluida_em && !dispensaAutovistoriaPorJanela) {
  return new Response(
    JSON.stringify({
      error: 'Aprovação bloqueada: passou da janela de mesmo-dia. O fluxo de troca expirou — peça nova adesão.',
      code: 'JANELA_TROCA_EXPIRADA',
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
```

## 2. Frontend — espelhar a mesma regra

**`src/components/troca-titularidade/ModalDetalhesTroca.tsx`** (linha 373):

```ts
const dispensaAutovistoriaPorJanela = (() => {
  if (!solicitacao.termo_cancelamento_assinado_em) return false;
  const a = new Date(solicitacao.termo_cancelamento_assinado_em);
  const fimDiaBRTemUTC = new Date(Date.UTC(
    a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(),
    26, 59, 59, 999
  ));
  return new Date() <= fimDiaBRTemUTC;
})();
const bloqueadoPorAutovistoria =
  modo === 'cadastro'
  && !solicitacao.autovistoria_concluida_em
  && !dispensaAutovistoriaPorJanela;
```

E esconder o badge "Aguardando autovistoria" quando `dispensaAutovistoriaPorJanela=true`.

## 3. Link público — pular a etapa de vistoria na janela mesmo-dia

**`src/pages/public/CotacaoContratacao.tsx`**

Quando `isTrocaTitularidade=true` E está na janela (mesma helper, alimentada por `solicitacaoTroca.termo_cancelamento_assinado_em`):

- **Etapa 3 (Vistoria):** não renderizar `<EtapaVistoria>`. Mostrar card "Vistoria inicial dispensada — proteção do titular antigo estendida a você. O Monitoramento avaliará a pontuação do rastreador na análise final" com botão "Continuar".
- **Remover etapa "Vistoria"** do `STEPS` visíveis (mesma técnica já usada para adicionar etapa "Instalação" no caminho autovistoria).
- Após pagamento, render `TelaAnaliseTrocaTitularidade` (já existente, linha 922).
- Se a cotação tiver `tipo_vistoria` setado por engano (`agendada_base`/`agendada`), ignorar no cálculo de `etapaDoStatus` quando troca em janela.

Fora da janela: mostrar "Prazo expirado — esta troca foi cancelada".

## 4. Saneamento do caso COT-20260515-172515652-649

```sql
-- Cancelar agendamento_base criado por bug de roteamento
UPDATE agendamentos_base
   SET status='cancelado',
       cancelado_em=now(),
       motivo_cancelamento='Troca de titularidade dentro da janela mesmo-dia — vistoria inicial dispensada. Agendamento criado por bug de roteamento.'
 WHERE cotacao_id=(SELECT cotacao_id FROM solicitacoes_troca_titularidade WHERE id='06037fb8-84bb-4856-a723-2b2baea55c5d')
   AND status NOT IN ('cancelado','concluido');

-- Limpar tipo_vistoria errado
UPDATE cotacoes
   SET tipo_vistoria=NULL
 WHERE id=(SELECT cotacao_id FROM solicitacoes_troca_titularidade WHERE id='06037fb8-84bb-4856-a723-2b2baea55c5d');

INSERT INTO logs_auditoria(acao,modulo,descricao,dados_novos)
VALUES('reset_vistoria_troca_janela_mesmo_dia','troca_titularidade',
       'Vistoria dispensada (janela mesmo-dia). Cancelado agendamento_base e limpado tipo_vistoria.',
       jsonb_build_object('solicitacao_id','06037fb8-84bb-4856-a723-2b2baea55c5d','placa','KOU6D37'));
```

Após isso, abro como admin em `/cadastro/processos`, confirmo "Situação Financeira (SGA)" e clico **Aprovar** — agora desbloqueado. Vai para `aguardando_monitoramento` para análise final (avaliação do rastreador).

## 5. "Cadastro aprovava direto sem aparecer no painel"

Auditado: `vincular-cotacao-troca` grava `aguardando_cadastro, cadastro_auto_aprovado=false` (linhas 122-123). A migration `20260514231321` reescreveu o trigger para nunca promover automaticamente a partir de `aguardando_cadastro`. **Já corrigido — sem ação.**

## 6. Memória

Substituir `mem://logic/operations/troca-titularidade-monitoramento-pos-vistoria` (desatualizado) por `mem://logic/operations/troca-titularidade-janela-mesmo-dia`:

> Troca de titularidade — janela mesmo-dia: até 23:59:59 BRT do dia da assinatura do termo de cancelamento, a autovistoria inicial é DISPENSADA — apenas a cobertura/proteção do titular antigo é estendida ao novo. Link público da troca pula a etapa de vistoria (vai docs → assinatura → pagamento → "Em Análise Cadastral"). Cadastro aprova manualmente → `aguardando_monitoramento`. Monitoramento avalia a pontuação do rastreador e decide: aprovar / pedir vistoria (só fotos ou fotos+instalação, link vira agendamento) / pedir manutenção de rastreador. Vistoria pedida → técnico executa → trigger devolve para `aguardando_monitoramento`. Passou da janela → `cron-expirar-trocas-titularidade` cancela veículo + invalida link → exige nova adesão.

Atualizar o índice substituindo o item antigo (não duplicar).

# Fora de escopo

- Botão "Solicitar manutenção de rastreador" no Monitoramento — já existe.
- `cron-expirar-trocas-titularidade` / `aprovar-proposta` — comportamento permanece igual.
