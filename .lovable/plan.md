

## Plano: Guard de Idempotência no SGA

### Problema
A edge function `sga-hinova-sync` não verifica se o veículo já está sincronizado antes de executar. O `usePropostasPendentes` (linha 1667) busca o veículo sem filtrar por `sincronizado_hinova`, gerando chamadas desnecessárias à API Hinova.

### Alterações

**1. Edge function `sga-hinova-sync/index.ts` — Guard de idempotência (alteração principal)**

Após a validação de `veiculo_id`/`associado_id` (linha 442) e antes de marcar `status_sga = 'sincronizando'` (linha 446), adicionar:

```typescript
// Guard de idempotência: verificar se já está sincronizado
const { data: veiculoCheck } = await supabase
  .from('veiculos')
  .select('sincronizado_hinova, codigo_hinova, status_sga')
  .eq('id', veiculo_id)
  .single();

if (veiculoCheck?.sincronizado_hinova && veiculoCheck?.codigo_hinova) {
  console.log(`[SGA Sync] Veículo ${veiculo_id} já sincronizado (codigo_hinova=${veiculoCheck.codigo_hinova}). Retornando sucesso.`);
  await logSync(veiculo_id, associado_id, 'idempotency_guard', 'skipped', { veiculo_id, associado_id }, { codigo_hinova: veiculoCheck.codigo_hinova });
  await markQueueCompleted(supabase, veiculo_id, associado_id);
  return new Response(
    JSON.stringify({
      success: true,
      data: { already_synced: true, codigo_veiculo_hinova: veiculoCheck.codigo_hinova },
      step: 'idempotency_guard'
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Guard contra processamento paralelo
if (veiculoCheck?.status_sga === 'sincronizando') {
  console.log(`[SGA Sync] Veículo ${veiculo_id} já em sincronização. Ignorando chamada duplicada.`);
  await logSync(veiculo_id, associado_id, 'idempotency_guard', 'skipped_in_progress', { veiculo_id, associado_id }, null);
  return new Response(
    JSON.stringify({
      success: true,
      data: { already_in_progress: true },
      step: 'idempotency_guard'
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

Isso protege contra:
- Reenvio quando já sincronizado (retorna sucesso sem chamar Hinova)
- Disparo paralelo quando já existe processamento em andamento
- Também limpa a fila de retry se o veículo já estiver sincronizado

**2. `usePropostasPendentes.ts` — Filtro preventivo no caller (linha 1667-1672)**

Adicionar `.eq('sincronizado_hinova', false)` na query antes de chamar o SGA, igual ao que `useAtivacoes` já faz:

```typescript
const { data: veiculoParaSGA } = await supabase
  .from('veiculos')
  .select('id')
  .eq('associado_id', associadoId)
  .eq('sincronizado_hinova', false)
  .limit(1)
  .maybeSingle();
```

### O que NÃO muda
- Fluxo de aprovação de proposta — continua igual
- Edge function `ativar-associado` — zero alterações
- Mensagem WhatsApp — não tocada
- Botões manuais e fila de retry — continuam funcionando
- Em caso de erro real, o reenvio manual e automático continua possível (pois `sincronizado_hinova` permanece `false` em caso de falha)

