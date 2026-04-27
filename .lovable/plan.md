# Plano: corrigir definitivamente o "Erro ao iniciar rota"

## 1. Diagnóstico (causa raiz)

Acessei o banco como diretor e investiguei o serviço da tela (Andresa, Rua Caminho dos Astros, Rafael Peixoto):

- O serviço exibido pelo app do técnico (`12bbff07-…`, associado 7622ee03-…, bairro "PQ CENTENARIO") **foi cancelado** às 23:08:02 — junto com várias outras instalações em massa (mesmo timestamp em ~10 registros). Outro serviço relacionado (`a4ff906f-…`) virou `nao_compareceu` às 23:10 **e perdeu o `profissional_id`**.
- Quando o técnico toca "Iniciar Percurso/Tarefa", o hook `useIniciarRota` (`src/hooks/useTarefaAtual.ts`) executa:
  1. `SELECT profissional_id FROM servicos WHERE id=...`
  2. Se `profissional_id` é NULL → lança `"Serviço não atribuído a nenhum profissional"`.
  3. Se diferente do `profile.id` → lança `"Este serviço não está atribuído a você"`.
  4. Mesmo se passar, o trigger `validar_status_servico` no banco bloqueia qualquer transição para `em_rota`/`em_andamento` quando `profissional_id IS NULL`, com `RAISE EXCEPTION`.
- O `onError` do hook **descarta a mensagem real** e mostra o toast genérico `"Erro ao iniciar rota"`.
- A tela do app continua mostrando a tarefa antiga porque `useTarefaAtual` faz polling a cada 30s (com `staleTime` 15s) e o cancelamento ocorreu por trigger no banco — sem realtime forçando invalidação no aparelho do técnico até o próximo refetch.

**Resumo da causa raiz:** o serviço foi cancelado/desatribuído por outro fluxo (cancelamento de instalação/cotação/no-show ou reatribuição) **enquanto o card já estava renderizado no aparelho do técnico**. Ao clicar, o app tenta atualizar um registro que não pertence mais a ele e mostra um toast genérico, sem atualizar a tela nem explicar o motivo.

Isso vai continuar acontecendo sempre que: (a) coordenação cancelar/reatribuir uma tarefa, (b) cron de "não compareceu" rodar, (c) trigger em cascata de cancelamento de cotação/instalação/vistoria disparar, (d) o técnico estiver com a tela aberta sem refetch recente.

## 2. Correção pontual (resolver o erro visível agora)

1. **Mensagens de erro úteis** em `useIniciarRota` (e `useIniciarTarefa`):
   - Usar `error.message` no toast (em vez de string fixa).
   - Detectar os 3 cenários e mostrar mensagens específicas em PT-BR:
     - "Esta tarefa foi cancelada e não está mais disponível."
     - "Esta tarefa foi reatribuída a outro técnico."
     - "Esta tarefa precisa estar com status 'agendada' para iniciar."
2. **Auto-recuperação da tela**: em qualquer erro do `useIniciarRota`/`useIniciarTarefa`, invalidar `['tarefa-atual']` e `['servicos']` para o card sumir/atualizar imediatamente.
3. **Pré-checagem antes do clique**: ampliar o `select` inicial para trazer `status, profissional_id` e validar:
   - status ∈ ('agendada','em_rota') → caso contrário, abortar com mensagem clara.

## 3. Correção estrutural (evita classe inteira de bugs)

4. **RPC transacional `iniciar_rota_servico(p_servico_id)`** (SECURITY DEFINER):
   - Faz `SELECT … FOR UPDATE`, valida `profissional_id = auth.uid()`-mapeado-para-profile, valida status, atualiza para `em_rota` + `em_rota_em` em **uma única ida**.
   - Retorna JSON `{ ok, codigo_erro, mensagem }` para o cliente exibir mensagem precisa.
   - Mesma estratégia para `iniciar_tarefa_servico`.
   - Elimina race condition entre o `SELECT` e o `UPDATE` no cliente.
5. **Realtime no card do técnico**: assinar mudanças em `servicos` filtradas por `profissional_id=eq.<id>` no `useTarefaAtual` para refletir cancelamentos/reatribuições em segundos, em vez de aguardar o polling de 30s.
6. **Padronizar erros do banco com SQLSTATE**:
   - Atualizar `validar_status_servico` para usar `ERRCODE` próprios (ex.: `'P0001'` com prefixos `SERVICO_SEM_PROFISSIONAL`, `SERVICO_NAO_ATRIBUIDO`, `SERVICO_STATUS_INVALIDO`) e mensagens em PT-BR.
   - Cliente passa a mapear esses códigos para toasts amigáveis.
7. **Audit trail mínimo**: registrar em `error_reports` (ou tabela equivalente já existente) toda falha de transição de status com `servico_id`, `user_id`, `motivo`, para o coordenador ver no painel.

## 4. Arquivos / objetos a alterar

- `src/hooks/useTarefaAtual.ts` — `useIniciarRota`, `useIniciarTarefa`: chamar nova RPC, mensagens úteis, invalidação no `onError`, assinatura realtime.
- Nova migração SQL:
  - `iniciar_rota_servico(uuid)` e `iniciar_tarefa_servico(uuid)` (SECURITY DEFINER, retorno JSON).
  - Atualizar `validar_status_servico` com SQLSTATEs e mensagens claras.
- Opcional: incluir badge "Tarefa indisponível — atualizando…" no `TarefaAtualCard` quando o serviço sumir entre clique e refetch.

## 5. Validação após implantação

- Cancelar uma tarefa atribuída pelo painel do coordenador enquanto o técnico está com o app aberto → o card deve sumir em <5s e qualquer clique tardio mostra "Esta tarefa foi cancelada".
- Reatribuir tarefa do técnico A para o B → técnico A vê o card desaparecer; clique tardio diz "Esta tarefa foi reatribuída".
- Tentar iniciar rota com sucesso → status muda para `em_rota` e edge `notificar-inicio-rota` continua sendo chamada.
- Logs de `error_reports` registram todas as falhas com `codigo_erro` para análise.

## 6. Nota sobre o cenário observado

A onda de cancelamentos às 23:08:02 atingiu várias instalações simultaneamente — provavelmente um cancelamento em cascata via `cancelar_servicos_ao_cancelar_instalacao/_cotacao` ou `cron-no-show`. A correção acima trata o sintoma para o técnico, mas vale revisar separadamente **por que tantas instalações foram canceladas de uma vez** (fora do escopo deste plano, abrir tarefa específica se desejar).
