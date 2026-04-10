

## Plano: Atribuir rastreador avariado ao porte do tecnico na substituição

### Problema
Na substituição (manutenção com resultado "avariado/substituição"), o rastreador antigo é marcado como `retorno_base` ou `baixado` com `veiculo_id: null`, mas **não recebe o `portador_id` do técnico** que realizou o serviço. Isso significa que o rastreador avariado fica "solto" no sistema em vez de ficar no inventário do técnico para devolução à base.

### Mudança (1 arquivo)

**`src/hooks/useVistoriaManutencao.ts`** — função `useRegistrarResultadoManutencao`

1. Incluir `tecnico_id` no select do serviço (linha 488): `select('rastreador_id, veiculo_id, tecnico_id')`

2. No cenário "substituicao" (linha 594), ao atualizar o rastreador antigo, adicionar `portador_id: servico.tecnico_id` junto com `veiculo_id: null` e o novo status. Assim o rastreador avariado fica atribuído ao porte do técnico.

3. Na movimentação de estoque do rastreador antigo (linha 609), incluir `portador_id: servico.tecnico_id` se o campo existir na tabela `estoque_movimentacoes`, ou adicionar na observação.

### Resultado
- **Consertado (resolvido)**: rastreador continua no veículo normalmente (já funciona)
- **Avariado (substituicao)**: rastreador antigo vai para o porte do técnico (`portador_id = tecnico_id`), novo rastreador do porte é instalado no veículo (já funciona)
- **Retirada**: apenas atribui rastreador ao técnico e retira do veículo (já funciona)

