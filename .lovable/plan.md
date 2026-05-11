## Problema

No link público do novo titular, a etapa **"Vistoria"** está sempre visível, mesmo quando o Monitoramento já aprovou a troca **sem solicitar vistoria** (status `liberada_para_assinatura` direto). Adicionalmente, hoje, ao clicar "Solicitar vistoria" no modal de monitoramento, a edge function `aprovar-troca-monitoramento` cria um registro em `servicos` (vistoria_entrada) — o usuário pediu que isso NÃO aconteça: a vistoria deve ser executada pelo próprio novo titular dentro do link público.

## Comportamento desejado

| Ação do Monitoramento | Status da solicitação | Etapa "Vistoria" no link público | Botão "Aprovar" no modal |
|---|---|---|---|
| Aprova direto (sem vistoria) | `liberada_para_assinatura` | **Oculta** — pula direto para Pagamento | n/a (já aprovado) |
| Clica "Solicitar vistoria" | `aguardando_vistoria` | **Visível** — novo titular escolhe autovistoria/agendada/base | **Sumido** até vistoria ser concluída |
| Vistoria concluída pelo novo titular | continua `aguardando_vistoria` | Marcada como concluída (read-only) | **Reaparece** para liberar assinatura |
| Monitoramento aprova após vistoria | `liberada_para_assinatura` | Concluída | n/a |

Nenhum registro em `servicos` é criado pela solicitação de vistoria de troca — a execução acontece 100% dentro do fluxo público existente (`EtapaVistoria`).

## Mudanças

### 1. Edge `supabase/functions/aprovar-troca-monitoramento/index.ts`
- No ramo `solicitar_vistoria`: **remover** o `INSERT` em `servicos` e a gravação de `servico_vistoria_id`.
- Apenas atualiza `status='aguardando_vistoria'` + `aprovado_monitoramento_*` (auditoria de que a etapa foi solicitada). O sinal "vistoria foi pedida" passa a ser o próprio status `aguardando_vistoria`.

### 2. Hook `src/hooks/useSolicitacaoTrocaPublicaPorCotacao.ts`
- Já expõe `status`. Manter `servico_vistoria_id` no select para retrocompatibilidade visual mas a lógica de UI passa a olhar apenas o `status`.

### 3. `src/pages/public/CotacaoContratacao.tsx`
- Calcular `vistoriaTrocaSolicitada = isTrocaTitularidade && (solicitacaoTroca?.status === 'aguardando_vistoria' || !!cotacao?.tipo_vistoria)`.
- Ajustar `STEPS` (memo): se `isTrocaTitularidade && !vistoriaTrocaSolicitada`, **remover** o item `{ id: 'vistoria' }` do array. Os índices de Pagamento/Instalação se ajustam pelo `STEPS.length`.
- Ajustar `etapaDoStatus` e `isEtapaConcluida` para considerar o STEPS dinâmico (mapear por `id`, não por índice fixo). Quando vistoria está oculta e status='liberada_para_assinatura', cair direto em "Pagamento".
- A renderização condicional dos blocos por `etapaAtual === 3 / 4` passa a usar o índice do step (`STEPS.findIndex(s => s.id === 'vistoria' | 'pagamento')`) para não quebrar quando vistoria é removida.

### 4. `src/components/troca-titularidade/ModalDetalhesTroca.tsx`
- Quando `modo='monitoramento'` e `status='aguardando_vistoria'`:
  - Buscar `cotacao.tipo_vistoria` / `vistoria_concluida_em` da cotação vinculada (via novo select no `useSolicitacaoTroca` ou query auxiliar) para saber se o novo titular já fez a vistoria.
  - **Ocultar** o botão "Aprovar" enquanto vistoria não estiver concluída; manter "Reprovar" disponível.
  - Mostrar bloco informativo: "Aguardando o novo titular concluir a vistoria pelo link público".
  - Reabrir botão "Aprovar" assim que `tipo_vistoria` estiver preenchido (autovistoria com fotos aprovadas pelo monitoramento na aba de aprovação de vistorias, OU agendamento presencial concluído).
- `podeAgir` passa a aceitar também `status === 'aguardando_vistoria'` somente quando vistoria foi concluída.

### 5. `src/hooks/useSolicitacoesTroca.ts`
- Estender `useSolicitacaoTroca` para retornar também `cotacao:cotacao_id(tipo_vistoria, vistoria_concluida_em)` para alimentar a regra do modal.

### 6. (Opcional / cleanup) `MiniCardVistoriaTroca`
- Hoje recebe `servico_vistoria_id`. Como deixaremos de criar o serviço, este componente passa a renderizar nada quando `servico_vistoria_id` é nulo (o status da vistoria virá do `VistoriaLinkBlock` / `cotacao.tipo_vistoria`). Sem alteração de assinatura.

## Detalhes técnicos

- Nenhum migration necessário: o campo `servico_vistoria_id` continua existindo (nullable) — apenas deixa de ser populado em novas solicitações. Solicitações antigas com serviço criado seguem funcionando.
- Não mexer na lógica de instalação/serviços de campo de outros fluxos (substituição, inclusão).
- Tutorial `aprovacao-troca-titularidade-monitoramento.ts` precisa de uma pequena nota: ao clicar "Solicitar vistoria", a vistoria é executada pelo cliente no link público — não vai para a fila de Serviços de Campo.

## Arquivos afetados
- `supabase/functions/aprovar-troca-monitoramento/index.ts`
- `src/pages/public/CotacaoContratacao.tsx`
- `src/components/troca-titularidade/ModalDetalhesTroca.tsx`
- `src/hooks/useSolicitacoesTroca.ts`
- `src/data/tutoriais/aprovacao-troca-titularidade-monitoramento.ts` (nota)
