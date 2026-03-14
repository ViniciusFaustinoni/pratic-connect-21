
Objetivo: garantir que o vistoriador ativo receba a tarefa automaticamente mesmo quando o serviço nasce sem coordenadas, e eliminar regressão que apaga latitude/longitude após atribuição.

Diagnóstico confirmado (com evidências)
- O app estava chamando `atribuir-proxima-tarefa` via polling e recebendo `sem_tarefas`.
- Logs da função mostraram: `Serviços encontrados: 0` e `Sem coordenadas: 1`.
- O serviço pendente era `184bcdfa...` (permite_encaixe=true) e estava com `latitude/longitude = null`.
- No momento da criação da instalação, o geocode falhou por `429` (Nominatim rate limit), então a tarefa ficou sem coordenadas.
- O `cron-atribuir-tarefas` depois conseguiu atribuir (20:35), mas há bug de persistência:
  - ele atualiza `instalacoes` com colunas inexistentes (`latitude/longitude`), em vez de `endereco_latitude/endereco_longitude`;
  - em seguida, a sincronização instalação→serviço sobrescreve coordenadas do `servicos` com `null`.

Plano de implementação
1) Corrigir atribuição em tempo real (sem depender do cron)
- Arquivo: `supabase/functions/atribuir-proxima-tarefa/index.ts`
- Adicionar busca de serviços sem coordenadas (mesmos filtros de status/data/local/confirmação).
- Tentar geocodificação on-the-fly (logradouro+numero+bairro+cidade; fallback bairro+cidade).
- Persistir coordenadas em:
  - `servicos.latitude/longitude`
  - `instalacoes.endereco_latitude/endereco_longitude` (quando origem for instalação)
  - `vistorias.endereco_latitude/endereco_longitude` (quando origem for vistoria)
- Reprocessar os serviços geocodificados no mesmo request para permitir atribuição imediata ao profissional ativo.

2) Corrigir bug de coluna no cron
- Arquivo: `supabase/functions/cron-atribuir-tarefas/index.ts`
- Trocar updates incorretos em `instalacoes`:
  - de `{ latitude, longitude }`
  - para `{ endereco_latitude, endereco_longitude }`
- Validar e logar `error` de todos os updates de geocode/sincronização (hoje há updates sem checagem).

3) Blindagem no banco contra “apagamento” de coordenadas
- Nova migration SQL:
  - recriar `sync_instalacao_update_to_servicos` e `sync_vistoria_update_to_servicos` para usar `COALESCE(NEW.endereco_latitude, servicos.latitude)` e equivalente para longitude.
- Resultado: updates de status/profissional não podem zerar coordenadas já válidas.

4) Robustez do geocode de criação
- Arquivo: `supabase/functions/geocode-endereco/index.ts`
- Tratar `429` com retry curto (respeitando `Retry-After` quando presente) + fallback.
- Retornar motivo explícito (`rate_limited`) para facilitar monitoramento.

5) Correção de dados já afetados
- Rodar rotina de reparo (após deploy) para serviços ativos/pendentes com coords nulas:
  - geocodificar endereço
  - atualizar `servicos` e tabela de origem
- Disparar `cron-atribuir-tarefas` ao final para garantir distribuição imediata pendente.

Detalhes técnicos (resumo)
- Arquivos-alvo:
  - `supabase/functions/atribuir-proxima-tarefa/index.ts`
  - `supabase/functions/cron-atribuir-tarefas/index.ts`
  - `supabase/functions/geocode-endereco/index.ts`
  - `supabase/migrations/*_protect_coords_sync.sql` (nova)
- Critérios de aceite:
  1. Vistoriador ativo recebe tarefa no polling mesmo quando nasceu sem coords.
  2. Serviço atribuído mantém coordenadas após sincronizações.
  3. Não há mais caso de “sem_tarefas” com serviço elegível sem coordenadas.
  4. Logs passam a mostrar claramente falha/sucesso de geocodificação e persistência.
