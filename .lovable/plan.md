## Problema observado

Na tela "Processos Operacionais → Titularidade → Aguardando Cadastro", ao clicar em **Aprovar**:

1. O backend efetivamente avança a solicitação (`aguardando_cadastro` → `aguardando_monitoramento`), mas o frontend exibe um toast de erro e o modal não fecha.
2. O contador "Titularidade pendente" continua mostrando **1** mesmo após a solicitação ter saído da fila.
3. A solicitação aparece corretamente na fila do Monitoramento, comprovando que a aprovação ocorreu — só a UI não foi notificada.

## Causa raiz

A edge function `aprovar-troca-cadastro` faz, **depois** do `UPDATE` de status:

- Snapshot de análise prévia chamando `sga-buscar-associado-completo` (Hinova, lento/instável).
- Resolução de vendedor + `UPDATE` de cotação.
- Notificação WhatsApp via `whatsapp-send-text` (Evolution).

Quando o SGA ou o WhatsApp demoram/erram, o tempo total estoura o limite do invoke ou a função retorna em condição instável. O `supabase.functions.invoke` no hook devolve `error`, então:

- `onSuccess` **não roda** → `qc.invalidateQueries(['solicitacoes-troca'])` nunca dispara → contador permanece "1" até o `refetchInterval` de 30s.
- `handleAprovar` lança e **não chega** ao `onOpenChange(false)` → modal não fecha.
- Toast vermelho aparece, mesmo o `UPDATE` já tendo sido persistido (transação independente).

## Correção

### 1. `supabase/functions/aprovar-troca-cadastro/index.ts`

Mudar a ordem para "commit primeiro, efeitos colaterais depois":

- Validar travas (assinatura do termo, débito antigo) — mantém igual.
- Resolver `aprovador_id`.
- Executar **apenas** o `UPDATE` de status com CAS (`.eq('status','aguardando_cadastro')`) e checar se `count === 1`. Se não atualizou nada, retornar 409 idempotente ("já aprovada").
- Retornar `200 { success: true, status: 'aguardando_monitoramento' }` **imediatamente**.
- Disparar via `EdgeRuntime.waitUntil(...)` (ou `queueMicrotask` + `Promise` não-aguardada com try/catch global) o trabalho pesado:
  - snapshot da análise prévia (`sga-buscar-associado-completo`) → `UPDATE analise_previa_resultado/em`.
  - atribuição de vendedor + flag `prioridade='alta'` na cotação.
  - WhatsApp ao vendedor.
- Logar o resultado de cada bloco em `console.log` para auditoria; nenhum desses passos pode mais derrubar a resposta.

### 2. `src/hooks/useSolicitacoesTroca.ts`

Tornar o cliente tolerante a "sucesso silencioso":

- Em `useAprovarTrocaCadastro` e `useAprovarTrocaMonitoramento`, no `onError`, antes de mostrar o toast, refazer um `select status from solicitacoes_troca_titularidade where id=...`. Se o status já avançou (`aguardando_monitoramento` para Cadastro; `aguardando_vistoria`/`liberada_para_assinatura` para Monitoramento), tratar como sucesso: invalidar queries, fechar modal (via callback) e mostrar toast verde com aviso "Aprovada — processamento em segundo plano".
- Sempre invalidar `['solicitacoes-troca']` e `['solicitacao-troca']` em ambos `onSuccess` e no fallback do `onError` quando o status confirmou avanço.

### 3. `src/components/troca-titularidade/ModalDetalhesTroca.tsx`

Mover o `onOpenChange(false)` para dentro de um `try/finally` em `handleAprovar`/`handleSolicitarVistoria`/`handleReprovar`, fechando o modal sempre que a mutação retornar (sucesso ou o "sucesso silencioso" do item 2). Em erro real (status não avançou), manter modal aberto como hoje.

## Resultado esperado

- Clique em Aprovar fecha o modal em <1s, mesmo com SGA/WhatsApp lentos.
- Contador "Titularidade pendente" zera imediatamente (lista invalidada no `onSuccess`).
- Falhas em SGA/WhatsApp ficam como warning de log, sem impacto na UX, e a `analise_previa_resultado` vai sendo gravada quando o Hinova responder.
- Reaprovações acidentais retornam 409 com mensagem clara, sem reabrir o fluxo.

## Arquivos afetados

- `supabase/functions/aprovar-troca-cadastro/index.ts`
- `src/hooks/useSolicitacoesTroca.ts`
- `src/components/troca-titularidade/ModalDetalhesTroca.tsx`
