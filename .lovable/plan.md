

# Substituir verificação SGA por consulta local na tabela `veiculos`

## Problema
O sistema atualmente chama a Edge Function `sga-verificar-veiculo` (API Hinova) para verificar se uma placa já existe. Isso deve ser substituído por uma consulta direta na tabela `veiculos` do próprio banco de dados.

## Solução

### Arquivo: `src/hooks/useVerificarVeiculoSGA.ts`
Renomear para refletir a nova lógica. Substituir a chamada à Edge Function por uma query Supabase:

```ts
const placaNormalizada = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const { data } = await supabase
  .from('veiculos')
  .select('id, placa, modelo, marca, associado_id')
  .eq('placa', placaNormalizada)
  .eq('status', 'ativo')
  .limit(1);

return {
  existe: data && data.length > 0,
  mensagem: data?.length ? 'Veículo já cadastrado no sistema' : undefined,
};
```

A interface `SGAVerificacaoResult` permanece compatível (campos `existe`, `mensagem`, `aviso`), então os consumidores em `Cotador.tsx` e `CotacaoFormDialog.tsx` continuam funcionando sem alteração.

### Arquivo: `src/components/cotacoes/VeiculoSGAModal.tsx`
Atualizar os textos do modal:
- Titulo: "Veículo já cadastrado no sistema" (em vez de "no SGA")
- Descrição: "Este veículo já existe no sistema Pratic" (em vez de "SGA Hinova")

### Edge Function `sga-verificar-veiculo`
Pode ser removida futuramente, mas não é necessário agora -- simplesmente não será mais chamada.

## Impacto
- 1 hook alterado (query local em vez de Edge Function)
- 1 componente modal com textos atualizados
- 0 alterações nos consumidores (Cotador.tsx, CotacaoFormDialog.tsx)
- Verificação mais rápida (sem chamada HTTP externa)

