# Plano de correção definitiva do disparo em massa de cobranças

## Diagnóstico fechado
O problema não é só um erro isolado de validação. Há uma falha estrutural no fluxo de disparo em massa:

1. **A Edge Function depende de `lote_id` para chunks seguintes**.
2. **O frontend do importador só recebe esse `lote_id` se a resposta do 1º chunk voltar com sucesso**.
3. **Na prática, o 1º chunk chegou a executar e enviar mensagens**, mas o fluxo foi interrompido antes de concluir o ciclo completo no cliente.
4. **Isso deixou lotes presos em `processando`**, com envio parcial gravado no banco.
5. Depois disso, a tela de **Lote ativo** tenta operar sobre um lote antigo/errado ou sem continuidade válida, e novas tentativas acabam estourando em erros como `lote_id ausente` ou falhas genéricas de Edge Function.

## Evidências encontradas
- Existem lotes recentes presos em **`processando`** com contadores parcialmente avançados:
  - `dbaca865-...` com **83 associados**, **50 enviados**, status **processando**.
  - `2f4624ed-...` com o mesmo padrão.
- A função **efetivamente enviou mensagens** e gravou histórico em `whatsapp_mensagens` por volta de **15:29–15:30**.
- Ao mesmo tempo, o fluxo do importador exibiu **83 erros / 0 enviadas** na UI, o que mostra divergência entre **estado real do backend** e **estado percebido pelo frontend**.
- A tela `LoteAtivoCobrancas` já tem guarda para não chamar a função sem lote, então o erro atual é mais profundo do que “faltou um if”.
- A Edge Function `disparar-cobranca-csv-meta` mistura responsabilidades demais no mesmo endpoint:
  - criação do lote
  - reconciliação com lote anterior
  - persistência dos boletos do chunk
  - envio via Meta
  - gravação de histórico
  - atualização de KPIs
  - promoção do lote para `ativo`

## Causa raiz provável
O fluxo atual é **frágil a timeout/interrupção entre chunks**. Quando o 1º chunk processa no servidor mas a resposta não é concluída no cliente (timeout, rede, cold start, falha transitória ou erro após envio parcial), o cliente perde o `lote_id`, e os próximos chunks falham. Isso gera:

- envio parcial já consumado
- lote órfão em `processando`
- duplicidade potencial em novas tentativas
- UI inconsistente
- impossibilidade de retomada segura

## Correção definitiva proposta

### 1) Separar “criação/recuperação do lote” de “envio dos chunks”
Criar um fluxo resiliente em duas fases:

- **Fase A: inicialização do lote**
  - criar ou retomar um lote de disparo
  - reconciliar com lote anterior
  - persistir metadados do CSV/remessa
  - devolver **sempre** um `lote_id` estável antes do envio pesado
- **Fase B: processamento de chunks**
  - receber `lote_id` obrigatório
  - persistir boletos do chunk
  - disparar mensagens
  - atualizar status incrementalmente

Isso elimina a dependência perigosa de “o primeiro chunk precisa terminar inteiro para só então existir lote”.

### 2) Implementar retomada idempotente de lote em `processando`
Se houver lote recente da mesma remessa ainda em `processando`, o sistema deve:
- reaproveitar o lote existente
- não recriar tudo
- não duplicar boletos já persistidos
- permitir continuação segura do envio

### 3) Tornar o processamento por destinatário/boletos idempotente
Antes de inserir/enviar, o sistema deve reconhecer itens já processados para o mesmo `lote_id`, evitando:
- duplicação de boletos no lote
- reenvio da mesma cobrança para o mesmo associado/telefone
- contadores inflados

### 4) Introduzir status mais claros no ciclo do lote
Hoje `processando` e `ativo` não bastam. O plano é consolidar estados operacionais como:
- `processando`
- `parcial`
- `ativo`
- `falha`
- `substituido`
- `cancelado`

Assim a UI deixa de tratar lote quebrado como se estivesse pronto para uso.

### 5) Corrigir a regra da tela “Lote ativo · Disparo Meta”
Essa tela deve aceitar somente lotes realmente utilizáveis, com validações como:
- não usar lote em `processando` incompleto
- exibir aviso para **retomar lote pendente** ou **descartar/reiniciar remessa**
- nunca disparar em cima de lote inconsistente herdado de tentativa interrompida

### 6) Melhorar o tratamento de erro do frontend
O frontend precisa distinguir:
- erro de rede/timeout
- erro real do backend
- envio parcial concluído no servidor
- lote pendente de retomada

Em vez de mostrar tudo como “falhou”, a tela deve refletir o estado real do lote.

### 7) Instrumentação e logs diagnósticos
Adicionar logs estruturados por etapa:
- início do lote
- lote retomado vs criado
- chunk recebido
- boletos inseridos
- mensagens enviadas
- promoção para ativo
- falha final com contexto

Isso permitirá diagnosticar rapidamente qualquer nova ocorrência.

### 8) Saneamento dos dados quebrados já existentes
Corrigir os lotes órfãos atuais para que o sistema volte a operar sem carregar estado corrompido. Isso inclui:
- identificar lotes presos em `processando`
- classificar se são retomáveis, finalizáveis ou descartáveis
- alinhar seus status com a realidade dos boletos/mensagens já gravados

## Arquivos e áreas que serão envolvidos
- `supabase/functions/disparar-cobranca-csv-meta/index.ts`
- `src/components/financeiro/ImportarCobrancaCsv.tsx`
- `src/components/financeiro/LoteAtivoCobrancas.tsx`
- possível migração SQL para reforço de status/índices/idempotência do fluxo

## Resultado esperado após a correção
- O disparo em massa não perde mais o `lote_id` no meio do processo.
- Quedas de rede ou timeout não deixam o fluxo irrecuperável.
- O sistema consegue retomar remessas interrompidas sem duplicar envio.
- A tela mostra o estado real do lote e não mascara sucesso parcial como falha total.
- Lotes quebrados antigos deixam de contaminar novas tentativas.

## Detalhes técnicos
```text
Fluxo alvo:
1. Importador inicia remessa
2. Backend cria/retoma lote e devolve lote_id imediatamente
3. Frontend envia chunks sempre com lote_id garantido
4. Backend processa chunks de forma idempotente
5. Último chunk consolida status final do lote
6. Tela de lote ativo só opera sobre lotes íntegros
```

## Validação final
Após implementar, vou validar com estes cenários:
- disparo normal com remessa pequena
- disparo com múltiplos chunks
- interrupção após 1º chunk e retomada
- reexecução da mesma remessa sem duplicação
- lote interrompido não aparecendo como ativo indevido
- KPIs e tabela final refletindo exatamente o que foi enviado