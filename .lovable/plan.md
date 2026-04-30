## Diagnóstico — OOV8C87 / GILBERTO SILVA MOREIRA

O serviço `573065e2…` está com `status='cancelada'` desde **27/04 10:38**, com observação:

> `[27/04/2026 10:38] Cancelado automaticamente por inatividade — backfill (serviço fantasma travando agenda do técnico).`

A instalação `fd393cca…` também foi marcada como `cancelada` no mesmo momento. Não foi um cancelamento operacional — foi uma rotina automática que limpou serviços "fantasmas" antigos.

### Por que dá erro só nele

No `ServicoDetailModal.tsx` (linha 132), o botão **Realocar** é exibido para qualquer serviço de instalação com status em `['agendada','nao_compareceu','reagendada','cancelada']` — **inclusive `cancelada`**.

Mas a RPC `realocar_servico` (migration 20260429210653…, linha 75) trata `cancelada` como **status terminal** e bloqueia:

```sql
IF _servico.status IN ('concluida','aprovada','reprovada','aprovada_ressalvas','cancelada') THEN
  RAISE EXCEPTION 'Serviço em status terminal (%) não pode ser realocado', _servico.status;
```

Resultado: a UI oferece a ação, o usuário preenche o modal, e a RPC recusa. Os outros associados que o monitoramento conseguiu realocar não estavam em `cancelada` — estavam em `agendada`/`nao_compareceu`/`reagendada`.

### Escopo do problema

A consulta mostrou **19 serviços** auto-cancelados pelo mesmo backfill em 27/04 (HUGO MOURA, PATRICK BONZE, RAFAEL LUCINDO, ALEX, WENDEL, LEANDRO, FABIO, HILLARY, DOUGLAS, MARCUS, CAIO, LUIZ COSME, DANIEL, SANDER, etc.). Qualquer tentativa de realocá-los via monitoramento vai reproduzir exatamente o mesmo erro.

---

## Correção — raiz

### 1) RPC `realocar_servico` — aceitar `cancelada` como reabertura

Liberar `cancelada` da lista de status terminais e tratá-lo como **reabertura controlada**:

- continua bloqueando `concluida`, `aprovada`, `reprovada`, `aprovada_ressalvas` (esses sim são terminais reais);
- para `cancelada`, a RPC vai:
  - reabrir o `servico` (`status='agendada'`, nova data/período, limpa `iniciada_em`/`em_rota_em`/`confirmacao_whatsapp`, zera `cancelada_em`/`cancelada_motivo` se existirem);
  - reabrir a `instalacao` correspondente (`status='agendada'` quando estava `cancelada`);
  - registrar no histórico/log a `categoria` como `reabertura_pos_cancelamento` e exigir `motivo` (já é obrigatório, mín. 5 chars);
  - manter a auditoria que já existe (linhas seguintes da própria RPC).

Sem isso, qualquer serviço cancelado (manual ou pelo backfill) fica preso para sempre.

### 2) UI `ServicoDetailModal.tsx` — alinhar rótulo

Manter `cancelada` na lista que mostra o botão, mas trocar o rótulo/tooltip para **"Reabrir e reagendar"** quando o serviço está `cancelada`, deixando claro o efeito ao monitoramento. Assim a UI passa a refletir o que a RPC faz.

### 3) Backfill operacional — reabrir os 19 órfãos? (decisão)

Os 19 serviços auto-cancelados em 27/04 continuam parados. Posso, opcionalmente, executar um backfill que apenas **destrava** (não reagenda automaticamente) — devolve à fila de atribuição manual com observação "Reaberto após cancelamento automático por backfill — definir nova data". Vou perguntar antes de executar (impacto operacional alto).

---

## Detalhes técnicos

- Arquivo da RPC: nova migration que faz `CREATE OR REPLACE FUNCTION public.realocar_servico(...)` reaproveitando o corpo atual da migration `20260429210653_…`, mudando apenas:
  - condição de status terminal: `IN ('concluida','aprovada','reprovada','aprovada_ressalvas')`
  - bloco antes do `UPDATE servicos`: se `_servico.status = 'cancelada'`, marca flag `_reabertura := true` e adiciona à observação `[reabertura pós-cancelamento]`;
  - após o `UPDATE servicos`, se `_reabertura` e existir `instalacao_origem_id`, faz `UPDATE instalacoes SET status='agendada', updated_at=now() WHERE id=_servico.instalacao_origem_id AND status='cancelada'`.
- Frontend: `src/components/servicos-campo/ServicoDetailModal.tsx` linhas 132–141 — manter a condição, trocar texto para `Reabrir e reagendar` quando `servico.status === 'cancelada'`. Sem mudança no `useRealocarInstalacao` (a RPC continua a mesma assinatura).
- Memória: atualizar `mem://logic/operations/dedupe-agendamentos-rule` com nota: "RPC `realocar_servico` aceita reabertura de `cancelada` (não terminal real)".

## Fora de escopo

- Não vou alterar o backfill de "serviço fantasma" — ele continua útil para limpar agendas presas. A correção é tornar o cancelamento reversível pela tela de monitoramento.
- Não vou tocar em `concluida`/`aprovada`/`reprovada` (esses permanecem terminais).

## Pergunta antes de executar

Após aprovar, devo também reabrir automaticamente os 19 serviços já presos pelo backfill de 27/04, ou deixar para o monitoramento reabrir um a um pela tela?
