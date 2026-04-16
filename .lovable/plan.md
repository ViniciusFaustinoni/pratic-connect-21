
Objetivo: fazer a tarefa do Renan aparecer para Wallace imediatamente no app do técnico.

Diagnóstico mais provável:
- O servidor já foi parcialmente corrigido antes (RPC + materialização de `servicos` para tarefas base).
- O bloqueio restante está no cliente do técnico, em `src/hooks/useTarefaAtual.ts`.
- Esse hook usa `profile.id` para buscar a tarefa, mas aborta se `auth.user.id !== profile.id`.
- Neste projeto isso é inconsistente com o restante da arquitetura: o banco e as policies usam `profiles.user_id = auth.uid()` e `get_my_profile_id()` para resolver o `profile.id`.
- Então, se o Wallace tiver `profile.id` diferente de `auth.users.id`, a tarefa existe no banco, mas o hook devolve `null` e a tela continua em “Você está ativo”.
- Invalidar cache no painel não resolve isso sozinho, porque a sessão do técnico é outra e a própria leitura local está descartando a tarefa.

Do I know what the issue is? Sim: o frontend provavelmente está filtrando a tarefa antes de renderizar.

Plano de correção:
1. Corrigir `useTarefaAtual`
   - Ajustar a validação de sessão para comparar `user.id` com `profile.user_id` (ou remover esse bloqueio rígido).
   - Manter `profile.id` como `p_profissional_id`, porque `servicos.profissional_id`, `vistorias.vistoriador_id` e `agendamentos_base.atendido_por` usam `profiles.id`.
   - Adicionar log temporário para confirmar `user.id`, `profile.id`, `profile.user_id` e retorno da RPC no caso do Wallace.

2. Eliminar drift entre hooks
   - Alinhar `src/hooks/useTarefaAtual.ts` com `useTarefaAtualServico()` ou extrair um fetcher compartilhado.
   - Evitar que existam duas lógicas diferentes para a mesma tarefa atual.

3. Reparar tarefas base já atribuídas
   - Criar uma migração de repair para garantir que todo `agendamentos_base` com `atendido_por` tenha:
     - `vistoria_id` válido
     - `vistorias.vistoriador_id` sincronizado
     - `servicos.profissional_id` sincronizado via `vistoria_origem_id`
   - Isso cobre reatribuições antigas que ficaram parcialmente materializadas.

4. Validar o caso Renan → Wallace
   - Conferir no banco:
     - `profiles` do Wallace (`id`, `user_id`, `ativo`)
     - `agendamentos_base` do Renan (`status`, `atendido_por`, `vistoria_id`)
     - `vistorias` vinculada (`vistoriador_id`)
     - `servicos` vinculado (`profissional_id`, `status`)
   - Testar com a conta do Wallace:
     - Home `/instalador`
     - aba `/instalador/tarefas`
     - abertura da tarefa
     - iniciar rota / iniciar vistoria

Arquivos a ajustar:
- `src/hooks/useTarefaAtual.ts`
- `src/hooks/useServicos.ts` ou um fetcher compartilhado
- `supabase/migrations/<nova_repair_migration>.sql`

Resultado esperado:
- A tarefa do Renan aparece para o Wallace mesmo se `profile.id != auth.users.id`
- Casos base antigos deixam de ficar “meio sincronizados”
- A tarefa volta a ficar visível e executável no app do técnico
