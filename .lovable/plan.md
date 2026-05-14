## Causa raiz (confirmada)

A Régua fica em "PREPARANDO… 0/0 (0%)" porque **o worker da edge function `executar-regua-cobranca` morre silenciosamente** sem nunca atualizar a `cobranca_runs` para `executando` ou `falhou`.

### Evidência no banco
Últimas 3 execuções (`cobranca_runs`):
```
status=preparando, total_planejado=0, finished_at=NULL  (18:07 BRT)
status=preparando, total_planejado=0, finished_at=NULL  (17:50 BRT)
status=preparando, total_planejado=0, finished_at=NULL  (17:49 BRT)
```
Nenhuma jamais saiu de `preparando`. A UI faz polling a cada 2s enquanto o status for `preparando` ou `executando` (`ReguaCobranca.tsx` linha 215) → loop infinito mostrando 0/0.

### O bug no código
Em `supabase/functions/executar-regua-cobranca/index.ts`, dentro do worker `prepararEdispararWorker` (linhas 207–589), quando o Hinova devolve erro transitório (janela horária fechada, 401, 429, 5xx) o catch faz:

```ts
} catch (e: any) {
  if (e instanceof HinovaTransientError) {
    const retry = calcularProximoRetry(e.reason)
    return jsonResp({ erro: 'hinova_transitorio', ... }, 503)   // ← linha 246
  }
  throw e
}
```

`jsonResp(...)` devolve um `Response`, mas **estamos dentro de um worker em background** (`EdgeRuntime.waitUntil(prepararEdispararWorker())`). Esse `Response` não vai pra lugar nenhum — ninguém lê. O worker simplesmente termina e a linha do `cobranca_runs` fica **eternamente em `preparando`** com `total_planejado=0`.

A `try/catch` externa (linhas 582–589) que marca `status='falhou'` só é acionada quando há `throw`. O `return` silencioso escapa dela.

### Por que o Hinova está dando transitório agora
Provavelmente "janela horária restrita" (Hinova bloqueia /listar/boleto-associado fora de horário comercial) ou auth 401. Mas isso **não deveria travar a UI** — o sistema deveria avisar e permitir tentar de novo.

## Plano (mudança mínima e correta)

**Arquivo único:** `supabase/functions/executar-regua-cobranca/index.ts`

### 1. Worker nunca pode sair sem atualizar status
Substituir os `return jsonResp(...)` de dentro do worker por `throw` (com mensagem amigável). A try/catch externa (linhas 582–589) já marca `status='falhou'` + grava `payload.erro`. Isso garante que **toda saída anormal vire `falhou`** e a UI saia do loop "PREPARANDO…".

Pontos a corrigir no worker:
- Linha 244–254: `HinovaTransientError` → trocar `return jsonResp(...)` por `throw new Error(\`Hinova indisponível (${e.reason}). Tente novamente em instantes.\`)`.

### 2. UI reagir a `status='falhou'`
Em `src/pages/cobranca/ReguaCobranca.tsx`:
- O `refetchInterval` (linha 217) já para quando status sai de `executando|preparando`, então `falhou` derruba o polling automaticamente.
- Adicionar um efeito (`useEffect` sobre `runStatus`) que dispara `toast.error` com `payload.erro` quando o run termina em `falhou`, e zera `runId` (ou mostra um botão "Tentar novamente") para a UI sair do estado "PREPARANDO".

### 3. Resgate dos runs travados (data fix one-shot)
Marcar como `falhou` os 3 runs presos para limpar o estado:
```sql
UPDATE cobranca_runs
SET status='falhou', finished_at=now(),
    payload = COALESCE(payload,'{}'::jsonb) || jsonb_build_object('erro','marcado por cleanup — worker abandonou em preparando')
WHERE status='preparando' AND finished_at IS NULL;
```
(Via migration tool, single statement.)

## Por que não é paliativo

- O `return` silencioso dentro de um background worker é o defeito real — qualquer falha temporária do Hinova vai recriar o sintoma. Trocar por `throw` integra a falha no fluxo de erro existente que já sabe atualizar `cobranca_runs.status='falhou'` com payload.
- A UI ganha sinal claro (toast + saída do loop) em vez de spinner infinito.
- Não muda comportamento de sucesso, não muda contratos, não muda schema.

## Fora de escopo

- Não vamos diagnosticar a falha Hinova específica (provável janela horária); a régua só precisa **reportar** o erro corretamente.
- Não vamos refatorar o worker para retry automático.
- Não vamos mexer em `mirrorBoletosEmCobrancas` nem na varredura de dedupe.
