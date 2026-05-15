# Plano de correção

## Objetivo
Impedir que contratos já aprovados pelo Cadastro voltem para a fila de Cadastro quando a vistoria/agendamento é materializada logo em seguida, garantindo que sigam apenas para Monitoramento.

## O que vou ajustar

1. **Blindar a aprovação do Cadastro no `aprovar-proposta`**
   - Revisar o guard anti-limbo que hoje pode zerar `cadastro_aprovado` cedo demais.
   - Fazer a validação respeitar o fluxo de `agendada_base` e outras materializações que acontecem quase ao mesmo tempo da aprovação.
   - Evitar a reversão imediata quando já houver indícios válidos de continuidade do fluxo.

2. **Criar reconciliação para casos já afetados**
   - Restaurar automaticamente o gate de Cadastro para contratos que hoje estão `assinado` mas já possuem `agendamento_base`, `vistoria` ou `servico` materializado.
   - Garantir que esses contratos passem a aparecer no Monitoramento, não no Cadastro.

3. **Manter a separação correta entre filas**
   - Validar que a fila do Cadastro continue mostrando apenas contratos ainda não aprovados pelo Cadastro.
   - Confirmar que a fila do Monitoramento continue dependendo de `cadastro_aprovado=true`, sem regressão no fluxo atual.

4. **Validar o caso do Marcos como referência**
   - Conferir que o contrato dele deixe de voltar para o Cadastro.
   - Verificar que, com vistoria/serviço já materializados, ele fique disponível apenas para a etapa seguinte do fluxo.

## Resultado esperado
- Após aprovação do Cadastro, o contrato não retorna mais para a fila de Cadastro.
- Casos com vistoria/agendamento já executados seguem para Monitoramento.
- O fluxo canônico de 8 etapas continua preservado.

## Detalhes técnicos
- Arquivos principais a revisar:
  - `supabase/functions/aprovar-proposta/index.ts`
  - possível migration de reconciliação/backfill para contratos revertidos indevidamente
  - hooks de leitura de fila apenas se necessário para manter paridade
- O foco da correção será na **regra de transição de estado**, não em ajuste visual da tela.