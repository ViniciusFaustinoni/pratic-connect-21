

## Plano: Correção de Stale Lock no SGA

### Problema
Se a edge function `sga-hinova-sync` travar ou der timeout, `status_sga` fica como `'sincronizando'` permanentemente, bloqueando retry e reenvio manual.

### Correção

**Arquivo único: `supabase/functions/sga-hinova-sync/index.ts` (linhas 470-482)**

Alterar o guard de processamento paralelo para incluir detecção de stale lock. Em vez de bloquear incondicionalmente quando `status_sga === 'sincronizando'`, verificar o log mais recente para determinar se o lock é legítimo (< 5 minutos) ou travado (≥ 5 minutos):

```typescript
// Se já existe processamento em andamento, verificar se é stale lock
if (veiculoCheck?.status_sga === 'sincronizando') {
  // Buscar o log mais recente para determinar quando o lock começou
  const { data: lastLog } = await supabase
    .from('sga_sync_logs')
    .select('created_at')
    .eq('veiculo_id', veiculo_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lockAge = lastLog?.created_at
    ? Date.now() - new Date(lastLog.created_at).getTime()
    : Infinity; // Sem log = lock órfão, tratar como stale

  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos

  if (lockAge < STALE_THRESHOLD_MS) {
    // Lock legítimo — sincronização real em andamento
    console.log(`[SGA Sync] Veículo ${veiculo_id} em sincronização há ${Math.round(lockAge/1000)}s. Ignorando.`);
    await logSync(veiculo_id, associado_id, 'idempotency_guard', 'skipped_in_progress', { veiculo_id, associado_id }, null);
    return new Response(
      JSON.stringify({ success: true, data: { already_in_progress: true }, step: 'idempotency_guard' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Stale lock — resetar e permitir nova tentativa
  console.log(`[SGA Sync] Stale lock detectado para veículo ${veiculo_id} (${Math.round(lockAge/1000)}s). Resetando status.`);
  await supabase
    .from('veiculos')
    .update({ status_sga: 'erro_sincronizacao' })
    .eq('id', veiculo_id);
  await logSync(veiculo_id, associado_id, 'stale_lock_recovery', 'recovered', { veiculo_id, lock_age_ms: lockAge }, null);
  // Continua execução normal (não retorna)
}
```

### O que muda
- Lock com < 5 min: comportamento idêntico ao atual (bloqueia chamada duplicada)
- Lock com ≥ 5 min: reseta para `erro_sincronizacao`, loga a recuperação, e permite nova tentativa
- Lock sem nenhum log associado: tratado como órfão/stale

### O que NÃO muda
- Mensagem de boas-vindas, template Meta, ativar-associado
- Fluxo de aprovação, ativação manual, botões
- Fila de retry, fotos, payload SGA
- Guard de idempotência (já sincronizado)

