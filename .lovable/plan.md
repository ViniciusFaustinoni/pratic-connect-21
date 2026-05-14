# Régua de Cobrança — corrigir "Failed to send a request to the Edge Function"

## Diagnóstico

Logs mostram que a edge function `executar-regua-cobranca` boota, executa, e em 17:41:12 emitiu apenas um warning de retry de auth Hinova antes do shutdown. O cliente recebeu **"Failed to send a request to the Edge Function"** — não é um 4xx/5xx, é o `supabase.functions.invoke` desistindo da conexão.

Causa raiz: a função faz **muito trabalho síncrono ANTES de responder**:

1. Lê régua + templates
2. Calcula janela
3. Chama Hinova `/listar/boleto-associado/periodo` (paginado, pode levar dezenas de segundos, e ainda tem retry de auth)
4. Pré-carrega `associados` + `veiculos`
5. Espelha boletos em `cobrancas` (mirror)
6. Classifica + ordena
7. Dedupe via `cobranca_eventos` (chunks de 200)
8. **Só então** cria `cobranca_runs` e retorna `run_id`

Esse pipeline rotineiramente excede o limite efetivo de CPU/tempo até o primeiro byte de resposta. Quando Hinova precisa do retry de auth (visto no log) o tempo extrapola e o `invoke` aborta antes da função enviar headers.

## Correção

Inverter a ordem: criar o `cobranca_runs` **imediatamente** com `status='preparando'`, devolver `{ run_id }` em <1s, e mover TODO o resto (Hinova → mirror → classificação → dedupe → disparo) para `EdgeRuntime.waitUntil`. A UI já faz polling em `cobranca_runs` — só precisa aceitar o estado intermediário `preparando`.

### Alterações

**1. `supabase/functions/executar-regua-cobranca/index.ts`**
- Após validar régua/etapas (passos 1–2 atuais, leves), inserir `cobranca_runs` com:
  - `status='preparando'`
  - `total_planejado=0` (será atualizado pelo worker)
  - `payload={ regua_id, started_at }`
- Retornar `{ run_id, status: 'preparando' }` imediatamente.
- Embrulhar TODO o restante (janela, Hinova, mirror, mapas locais, classificação, dedupe, worker de disparo) dentro de uma função async chamada via `EdgeRuntime.waitUntil(...)`.
- O worker, ao terminar a fase de preparação, faz `UPDATE cobranca_runs SET status='executando', total_planejado=…, payload=jsonb_set(...)` antes de iniciar o loop de envios. O loop de envios e a lógica pausar/cancelar permanecem iguais.
- Tratar falha da fase de preparação (ex.: Hinova 503) atualizando o run para `status='falhou'` com `payload.erro=…`.

**2. Migration**
- Adicionar `'preparando'` ao check constraint de `cobranca_runs.status` (hoje aceita `executando|pausado|concluido|cancelado|falhou`).

**3. `src/pages/cobranca/ReguaCobranca.tsx`**
- Aceitar `preparando` como estado ativo: badge `secondary` "Preparando…", desabilitar "Executar Agora" e mostrar Cancelar (sem Pausar enquanto preparando — a pausa só faz sentido depois que começa a enviar).
- Polling já existe; só mapear o novo status.

## O que NÃO muda

- Schema de `cobrancas`, `cobranca_eventos`, helper `cobrancas-sga-upsert`, lógica de templates, dispatcher WhatsApp, IA, ordenação, dedupe, janela 2 meses + corrente.
- Comportamento de pausar/retomar/cancelar durante o envio.
- Nenhuma chamada a Hinova é alterada.

## Resultado esperado

- Botão "Executar Agora" responde em <1s com toast "Run iniciada".
- UI mostra "Preparando…" enquanto Hinova/mirror rodam, depois transita para "Executando" e contadores começam a subir.
- Sem mais "Failed to send a request to the Edge Function".
