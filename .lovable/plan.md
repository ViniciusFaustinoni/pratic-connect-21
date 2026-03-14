

# Fix: Atribuição automática falhando por coordenadas nulas

## Problema
A instalação na Taquara, RJ (`EST CAFUNDA`) foi criada **sem latitude/longitude**. O trigger copiou `NULL` para a tabela `servicos`. O cron de atribuição automática filtra serviços sem coordenadas, então o vistoriador ativo nunca recebe a tarefa — o log mostra: *"Nenhum serviço disponível para profissional"*.

## Causa raiz
A geocodificação (Nominatim) pode falhar silenciosamente (rua não encontrada, timeout, etc.), e nenhuma camada posterior tenta novamente. Resultado: serviço fica permanentemente invisível para a atribuição.

## Solução em 2 partes

### Parte 1: Correção imediata dos dados (SQL)
Geocodificar o endereço "EST CAFUNDA, Taquara, Rio de Janeiro" e atualizar as coordenadas diretamente na `instalacoes` e `servicos` para desbloquear a atribuição agora.

### Parte 2: Fallback no cron (código)
Adicionar ao `cron-atribuir-tarefas` uma etapa de **geocodificação sob demanda**: antes de descartar serviços sem coordenadas, tentar geocodificar os que têm endereço mas faltam coordenadas. Isso previne que o problema se repita.

**Arquivo:** `supabase/functions/cron-atribuir-tarefas/index.ts`

Após buscar `servicosNormais` e `servicosEncaixe` (linhas 190-260), adicionar:

```text
Para cada serviço sem latitude/longitude MAS com logradouro + cidade:
  1. Chamar geocode-endereco via fetch interno
  2. Se sucesso, atualizar servicos.latitude/longitude no banco
  3. Incluir o serviço na lista com as coordenadas obtidas
  4. Log: "[cron-atribuir-tarefas] 📍 Geocodificado on-the-fly: {id}"
```

Isso garante que mesmo quando a geocodificação inicial falha, o serviço será geocodificado na próxima execução do cron (a cada 2-5 min) e atribuído normalmente.

### Arquivos a modificar
1. `supabase/functions/cron-atribuir-tarefas/index.ts` — adicionar geocodificação fallback para serviços sem coordenadas
2. **SQL direto** — corrigir as coordenadas do serviço/instalação existentes (Taquara, RJ: aprox. -22.9297, -43.3647)

