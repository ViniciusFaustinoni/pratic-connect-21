## Diagnóstico

A lista "Conversas IA" do chat de relacionamento (`EventosChatIA.tsx`) não mostra as mensagens disparadas pelo CSV de cobrança via Meta por dois motivos somados:

1. **Filtro por instância**: a query agrupadora restringe `whatsapp_mensagens.instancia_id IN (<instâncias ativas dos provedores 'meta'/'evolution'>)`. Hoje só existe **uma** instância ativa, do provedor `evolution` (`Principal`). Não há linha em `whatsapp_instancias` para o provedor `meta`.
2. **Insert do disparador**: a edge `disparar-cobranca-csv-meta` grava em `whatsapp_mensagens` sem nenhum `instancia_id` (ele acabou de ser corrigido pra incluir `provedor='meta'`, mas não vincula instância). Resultado: as linhas têm `instancia_id = null` e são excluídas pelo filtro `.in('instancia_id', ...)`.
3. **Atualização preguiçosa**: a tela depende só de `staleTime: 30s` + `refetchInterval: 60s`. Não há subscription realtime, então mesmo quando a mensagem é gravada com a instância correta, ela só aparece até 1 minuto depois.

## Correções (2 arquivos + 1 migration)

### 1. Garantir uma instância ativa do provedor Meta
Migration mínima: inserir em `whatsapp_instancias` uma linha lógica `('Meta WhatsApp', provedor='meta', ativa=true)` se não existir. Esse `id` será usado pelo edge para taggear as mensagens de cobrança.

### 2. Edge `disparar-cobranca-csv-meta`
- No início, ler/cachear `instancia_id` da `whatsapp_instancias` onde `provedor='meta' AND ativa=true` (ou cair na config Meta como fallback).
- Passar esse `instancia_id` em **ambos** os inserts em `whatsapp_mensagens` (sucesso e erro).
- Normalizar o `telefone` gravado ao mesmo formato exibido pelo chat (apenas dígitos com DDI 55) — já é o caso, manter.
- Garantir `nome_contato` ao gravar (usar `dest.nome` quando existir) pra a lista mostrar o nome ao invés de só o número.

### 3. Tela `EventosChatIA.tsx` (UI: realtime + atualização instantânea)
- Adicionar uma subscription Supabase Realtime em `whatsapp_mensagens` filtrando por `instancia_id IN (instanciasAtivas)` que dispara `queryClient.invalidateQueries(['chat-ia-conversas', ...])` em cada `INSERT`.
- Reduzir `staleTime` para `5s` e `refetchInterval` para `15s` como rede de segurança.
- Habilitar realtime na tabela (publication) caso ainda não esteja: `ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_mensagens` (skip-if-exists).
- Cleanup do canal no unmount (`supabase.removeChannel`).

### 4. (Opcional, baixo risco) Painel de cobrança
Manter o componente `ChatPanel` como está; ele já usa `useWhatsAppHistorico`. Verificar que a query desse hook também não filtra por instância — se filtrar, aplicar a mesma extensão.

## Resultado esperado
- Toda mensagem disparada pela importação CSV (Meta) entra com a instância "Meta WhatsApp" e aparece imediatamente em **Conversas IA**, com nome do associado quando conhecido e badge "Cobrança".
- Atualização em tempo real (sem reload) graças à subscription realtime.
- Nada muda no fluxo já existente do Evolution.
