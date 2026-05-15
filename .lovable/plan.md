## Problema

Marcus Vinicius (LTB4J74, FIPE R$ 69.952 → exige rastreador) apareceu na fila **Aprovações do Monitoramento › Aprovação de Associados** logo após o Cadastro aprovar a autovistoria. O fluxo correto para FIPE ≥ R$ 30k com autovistoria antecipada é:

1. Autovistoria → Cadastro libera R&F (já funciona ✓)
2. Técnico faz instalação + vistoria_entrada presencial
3. **Só então** entra na fila de Aprovação do Monitoramento

Hoje ele entra no passo 1, porque a "REGRA MESTRA" em `aprovar-proposta` (linhas 158-169) promove **qualquer** `servico vistoria_entrada` `em_analise` para `concluida` ao aprovar Cadastro — sem distinguir sub-FIPE de ≥30k.

Confirmado no banco: existem dois serviços `vistoria_entrada` para a placa:
- `49b7548b…` — modalidade=`autovistoria`, status=`concluida` (errado, é o que aparece na fila)
- `21611742…` — modalidade=`presencial`, status=`em_andamento` (a vistoria real do técnico, em curso)

## Correção

### 1. `supabase/functions/aprovar-proposta/index.ts` (linhas 158-169)

Restringir a promoção `em_analise → concluida` do servico de autovistoria **apenas a casos sub-FIPE** (veículo não precisa de rastreador). Para ≥30k:

- Marcar o servico de autovistoria como `aprovada` (terminal, fora da fila) com `analisado_em`/`analisado_por` preenchidos e observação registrando "autovistoria aprovada — R&F liberado; aguardando vistoria/instalação presencial do técnico".
- O servico presencial criado por `criar-instalacao-pos-pagamento` (instalação + vistoria do técnico) continua sendo o gatilho da fila, ao concluir.

A detecção sub-FIPE × ≥30k já existe mais adiante no mesmo arquivo (`veiculoPrecisaRastreador`, baseada em `valor_fipe`, `tipoVeiculo` e `configuracoes`). Vou mover a decisão para depois desse cálculo, ou replicar uma checagem leve antes do bloco de promoção. Preferência: **mover** o bloco de promoção para depois da resolução de `veiculoPrecisaRastreador` para não duplicar lógica.

Comportamento resultante por cenário:

| Cenário | Servico autovistoria após aprovar-proposta | Aparece na fila do Monitoramento? |
|---|---|---|
| Sub-FIPE (sem rastreador) | `concluida` | Sim — único caminho de aprovação |
| ≥30k com autovistoria antecipada | `aprovada` | Não — entra só quando técnico conclui presencial |
| ≥30k sem autovistoria (fluxo padrão) | n/a | Entra ao concluir vistoria/instalação do técnico |

### 2. Migração retroativa — caso Marcus (LTB4J74)

- Atualizar `servicos` `49b7548b-d391-4b2c-9f3a-f6c84d94eb0a` de `concluida` para `aprovada`, preenchendo `analisado_em=now()`, `observacoes_analise='[CORREÇÃO RETROATIVA] Autovistoria aprovada pelo Cadastro — R&F liberado; aguardando vistoria/instalação presencial do técnico para entrar na fila do Monitoramento.'`.
- Sem mexer em `cobertura_roubo_furto` do veículo (já está `true`, correto).
- Sem tocar no servico `21611742…` (presencial em_andamento — segue normalmente).
- Registrar entrada em `associados_historico` para auditoria.

## Fora de escopo

- Sub-FIPE: comportamento mantido (autovistoria → cadastro → monitoramento aprova direto, sem técnico).
- Troca de titularidade: já tem fluxo próprio (`vincular-cotacao-troca`), não afetado.
- UI: nenhuma alteração — o filtro do hook `useInstalacoesAguardandoAprovacao` continua igual; só muda quando o item entra.
