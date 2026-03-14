

# Fix: Enviar notificação "Proteção 360º Ativada" após aprovação do analista

## Problema
Quando o analista de cadastro aprova a proposta (após instalação já concluída), o fluxo em `usePropostasPendentes.ts`:
1. Ativa `cobertura_total: true` no veículo ✅
2. Chama `ativar-associado` → envia mensagem de boas-vindas ✅
3. **Não envia a notificação `cobertura_total_ativada`** ❌

O associado recebe apenas o "Bem-vindo à PRATIC!" mas nunca recebe o "🛡️ Proteção 360º Ativada!".

## Solução
Adicionar o disparo de `cobertura_total_ativada` no fluxo de aprovação do analista, logo após a linha 1508 (onde loga "Cobertura total ativada"), buscando os dados do veículo (placa, marca, modelo) e invocando `notificar-cliente`.

## Alteração

**Arquivo:** `src/hooks/usePropostasPendentes.ts` (~linha 1508)

Após `console.log('[useAprovarProposta] Cobertura total ativada...')`, adicionar:

```typescript
// Notificar associado sobre Proteção 360º
const { data: veiculoInfo } = await supabase
  .from('veiculos')
  .select('placa, marca, modelo')
  .eq('id', veiculoId)
  .single();

supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'cobertura_total_ativada',
    associado_id: associadoId,
    dados: {
      placa: veiculoInfo?.placa || '',
      marca: veiculoInfo?.marca || '',
      modelo: veiculoInfo?.modelo || '',
    },
  },
}).catch(err => console.warn('[useAprovarProposta] Erro ao notificar cobertura 360 (não crítico):', err));
```

## Arquivo a modificar
1. `src/hooks/usePropostasPendentes.ts` — Adicionar disparo de `cobertura_total_ativada` no bloco `jaTemInstalacaoConcluida`

