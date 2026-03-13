

## Plano: Corrigir veiculo_id e associado_id nos logs do SGA

### Diagnóstico

A função `logSync` (linha 332-355) está correta no código do repositório: recebe `veiculoId` e `associadoId` como parâmetros e insere na tabela `sga_sync_logs`. Todas as chamadas (linhas 458, 488, 501, 520, 539, 793, 817, 859, 913, 1062, 1124, 1146, 1556, 1583) passam `veiculo_id` e `associado_id` corretamente.

Porém, os 468 registros na tabela têm `veiculo_id = NULL` e `associado_id = NULL`. Possíveis causas:
1. Versão deployada está desatualizada (mais provável)
2. O supabase-js está silenciosamente descartando os campos no insert

### Correção

**Arquivo: `supabase/functions/sga-hinova-sync/index.ts` — função `logSync` (linhas 341-351)**

Adicionar log de diagnóstico e garantir que os valores não sejam perdidos:

```typescript
async function logSync(
    veiculoId: string | null,
    associadoId: string | null,
    action: string,
    status: string,
    requestPayload: any,
    responsePayload: any,
    errorMessage: string | null = null
  ) {
    try {
      const record = {
        veiculo_id: veiculoId || null,
        associado_id: associadoId || null,
        action,
        status,
        request_payload: requestPayload,
        response_payload: responsePayload,
        error_message: errorMessage,
        duracao_ms: Date.now() - startTime,
      };
      console.log(`[Log] Gravando log: action=${action}, veiculo_id=${veiculoId}, associado_id=${associadoId}`);
      const { error: insertError } = await supabase.from('sga_sync_logs').insert(record);
      if (insertError) {
        console.error('[Log] Erro no insert:', JSON.stringify(insertError));
      }
    } catch (e) {
      console.error('[Log] Erro ao registrar log:', e);
    }
  }
```

Mudanças:
- Construir o objeto `record` explicitamente antes do insert
- Logar os valores de `veiculo_id` e `associado_id` antes de inserir (diagnóstico)
- Capturar e logar o erro do insert (antes era ignorado — o `{ error }` não era verificado)

**Depois: redeploy da edge function e verificação pelos logs.**

Se após o redeploy os logs de diagnóstico mostrarem que `veiculo_id` e `associado_id` estão corretos no `console.log` mas continuam NULL na tabela, isso indicaria um problema no PostgREST/schema e precisaria de investigação adicional.

### O que NÃO muda
- Lógica de sincronização, stale lock, retry, idempotência
- Mensagem de boas-vindas
- Payload, aprovação, fotos

