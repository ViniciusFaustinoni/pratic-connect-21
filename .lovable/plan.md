## Diagnóstico dos 4 erros

Sem persistência de log (bug abaixo) só dá pra inferir, mas as causas prováveis dos 4 telefones que falharam, considerando o CSV enviado, são:

1. **`(131026) Receiver not a valid WhatsApp user`** — telefones fixos como `(24)99320-1885` válidos no formato mas sem WhatsApp ativo, ou números do tipo `(00)0000-00000` que escapam do validador atual (ele só checa tamanho 12–13 e prefixo `55`).
2. **`(131056) Pair rate limit hit`** — destinatários com muitos boletos disparam vários blocos sequenciais para o mesmo número com apenas 150 ms entre eles (ex.: ADEILSON com 9+ boletos).
3. **`(132005) Translated text too long`** — quando um único boleto isolado ainda ultrapassa 240 chars e é truncado com `…`, o template `cobranca_inadimplencia_pratic` continua rejeitando porque o limite real do parâmetro varia conforme a tradução cadastrada.
4. **`(100) Param missing / bloco vazio`** — destinatários cujos boletos foram todos deduplicados como já enviados em lote anterior caem no caminho `["" ]` (bloco vazio).

## Bug crítico de log (origem da cegueira)

`whatsapp_mensagens.insert(...)` usa `mensagem_id_externo`, mas a coluna é `message_id`. Resultado: **nenhum** envio é gravado (sucesso ou erro). Precisamos corrigir o nome do campo e remover o `.catch(()=>{})` mudo, trocando por `console.error` para que o log do edge fique disponível.

## Mudanças propostas (apenas no edge `disparar-cobranca-csv-meta`)

### 1. Persistência correta de logs
- Renomear `mensagem_id_externo` → `message_id`.
- Capturar `json.error.code`, `json.error.error_data?.details` e gravar em `erro_codigo` / `erro_mensagem`.
- Trocar `.then().catch(()=>{})` por `await ... ; if (error) console.error(...)` para diagnóstico futuro.

### 2. Validador de telefone mais rígido
- Rejeitar números com mais de 6 dígitos repetidos (`0000000`, `1111111`) → elimina `(00)0000-00000`.
- Exigir 13 dígitos começando com `55` + DDD válido + 9º dígito quando celular (DDD com mobile).
- Descartar telefones fixos (8 dígitos após DDD) — Meta sempre devolve 131026.

### 3. Anti rate-limit por número
- Aumentar o sleep **entre blocos do mesmo destinatário** de 150 ms → 1500 ms.
- Manter 150 ms entre destinatários distintos.
- Limitar a no máximo 3 blocos por destinatário; o restante entra em "boletos_pendentes_proximo_lote" (já temos a tabela `cobranca_csv_boletos`).

### 4. Segmentação de bloco mais segura
- Reduzir `MAX_META_BLOCK_LENGTH` de 240 → 180 (margem para encoding UTF-8 que a Meta conta como bytes em algumas locales).
- Nunca enviar bloco vazio: se `partes.length === 0`, marcar destinatário como `sem_boletos` e pular o envio (evita erro 100).
- Truncar linha digitável mantendo só dígitos quando o boleto isolado estourar 180 chars (a linha digitável formatada com pontos/espaço passa de 54 chars; sem formatação cai pra 47).

### 5. Reaproveitar `wa_id` por destinatário
- Quando o primeiro telefone responder OK, gravar `wa_id` retornado e **não** tentar o segundo telefone do mesmo associado (evita gastar quota e disparar 131056). Hoje o código tenta todos os telefones válidos sempre.

### 6. Relatório do front mostrando código Meta
- A resposta já traz `detalhes[]`. Adicionar `erro_codigo` para que o componente `ImportarCobrancaCsv.tsx` exiba o motivo (#131026, #132005, etc.) na tabela de resultado — facilita o operador entender o que rodar de novo.

## Resultado esperado
- Logs reais de cada envio passam a existir em `whatsapp_mensagens` (auditoria + reenvio).
- Eliminação dos 131026 causados por telefones inválidos do CSV.
- Eliminação dos 131056 com throttle por número.
- Eliminação dos 132005 com bloco menor + linha digitável só dígitos quando necessário.
- Eliminação do erro 100 com guarda de bloco vazio.

Nenhuma mudança de UI funcional além da coluna "código Meta" no relatório de resultado.
