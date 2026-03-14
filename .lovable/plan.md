

# Diagnóstico: Falhas na Sincronização SGA Hinova — Causas Raiz

## Problema Principal Confirmado

A sincronização está falhando repetidamente. Os dados dos logs dos últimos 7 dias mostram:

- **496 logs registrados** — **TODOS com `veiculo_id` e `associado_id` NULL**
- **44 falhas** em `cadastrar_associado` com erro "Não aceitável"
- **35 falhas** em `cadastrar_veiculo` com erro "Não aceitável"
- Apenas **8 sincronizações completas** (e estas também com IDs NULL)

---

## Causa Raiz 1: `veiculo_id` e `associado_id` NUNCA são gravados nos logs

O problema está na função `logSync` (linha 332). Ela recebe os parâmetros corretamente, **mas** o código de background (`doBackgroundSync`, linha 516) é uma closure que captura `veiculo_id` e `associado_id` do escopo externo. Porém, dentro do background, há múltiplos `return new Response(...)` (linhas 532, 553, 713, 721, 936, 944, 1174, 1186, 1192, 1199, etc.) que **retornam um Response dentro de uma função que NÃO é o handler HTTP** — esses returns são **silenciosamente ignorados** e não interrompem o fluxo.

**Impacto**: O código continua executando após erros que deveriam parar o processo. Erros se acumulam sem rastreabilidade (IDs NULL nos logs impossibilita debugging).

**Causa técnica**: A função `doBackgroundSync` é uma `async () => {}` que roda via `EdgeRuntime.waitUntil()`. Os `return new Response(...)` dentro dela não fazem nada — o Response não é enviado para ninguém. O handler HTTP já retornou `202 Accepted` na linha 1592.

## Causa Raiz 2: Loop infinito de CPF duplicado

O associado "MARCUS VINICIUS" (CPF 12493649737) está preso em loop:
1. Tenta cadastrar → Hinova diz "CPF já existe"
2. Tenta buscar por CPF → recebe 404 e 406 em todas as 3 estratégias de busca
3. Tenta recovery → mesmo resultado (404/406)
4. Não consegue recuperar o código → marca como erro
5. O cron-sga-retry re-executa → volta ao passo 1

Isso se repete a cada ~20 minutos indefinidamente. O associado **existe no Hinova** mas a API de busca **não o encontra** (provavelmente está em outra conta/regional).

## Causa Raiz 3: Código associado inválido causa cascade failure

Os logs de `cadastrar_veiculo` mostram: "O associado de código 29006 não está cadastrado no sistema" e "O associado de código 29023 não está cadastrado". O sistema recupera códigos de associado que são de **outra conta Hinova** (ou foram excluídos), tenta cadastrar o veículo com esses códigos, e falha. O mecanismo de invalidação funciona, mas gera um ciclo: invalida → recadastra → pega outro código inválido → invalida novamente.

## Causa Raiz 4: Background sync silencia todos os erros

Os `return new Response(...)` dentro de `doBackgroundSync` (linhas 532-534, 548-554, 713-721, etc.) **não interrompem a execução como esperado**. O código foi escrito como se fosse o handler HTTP direto, mas está dentro de uma closure. Quando um `return new Response(...)` é executado, o valor é descartado e a execução **pode continuar para o próximo passo** dependendo do flow control.

Na verdade, os returns DENTRO do `doBackgroundSync` funcionam como early returns da closure — eles SIM interrompem o background. Mas o Response retornado é jogado fora (ninguém o consome).

---

## Plano de Correção

### 1. Corrigir `doBackgroundSync` para não usar `return new Response`

Substituir todos os `return new Response(...)` dentro de `doBackgroundSync` por simples `return` (sem valor). A lógica de early-exit já funciona, mas os Response objects são lixo desnecessário. O que falta é **garantir que os IDs estão sendo passados corretamente para `logSync`**.

### 2. Detectar e bloquear loops infinitos

Adicionar um guard no início: se o associado já falhou X vezes consecutivas com o MESMO erro ("CPF já existe" + busca retorna 404), marcar como `falha_permanente` ao invés de continuar retentando.

### 3. Corrigir a fila de reenvio (sga_sync_queue)

A query atual mostra que a fila está vazia — o que indica que os itens estão sendo reprocessados pelo cron e re-inseridos sem os IDs corretos.

### 4. Adicionar logging com IDs explícitos

Garantir que `veiculo_id` e `associado_id` são passados em TODAS as chamadas `logSync` dentro do background.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---|---|
| `supabase/functions/sga-hinova-sync/index.ts` | Corrigir returns no background, adicionar guard de loop infinito, garantir IDs nos logs |
| `supabase/functions/cron-sga-retry/index.ts` | Adicionar detecção de loops e limite de retentativas por mesmo erro |

