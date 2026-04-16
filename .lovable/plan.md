
## Diagnóstico

Hoje o Wallace está alocado como **base** (via `alocacoes_diarias.tipo_alocacao = 'base'`). O comportamento esperado:

- Ver no app dele **todas as vistorias agendadas para hoje na base**, sem precisar de atribuição manual via mapa.
- Poder pegar/iniciar qualquer uma livremente, uma por vez.

### O que provavelmente está acontecendo

Preciso confirmar lendo o código, mas a hipótese é que a tela de "Minhas Tarefas" do técnico (provável `src/pages/instalador/...` ou equivalente) filtra por `vistoriador_id = profile.id` / `instalador_responsavel_id = profile.id`. Como vistorias de base ainda não têm vistoriador atribuído (são livres), a lista volta vazia ou só mostra o que foi explicitamente atribuído pelo monitoramento.

A memória `inspection-workflow-parity` confirma que vistorias de base e agendadas compartilham `ExecutarVistoriaCompleta.tsx`, mas não garante que a **listagem** do técnico inclua o pool de base.

### Investigação necessária (próxima rodada, modo default)

1. Localizar a tela "Minhas Tarefas / Hoje" do app do instalador/vistoriador (`src/pages/instalador/*`).
2. Identificar a query/hook que carrega as tarefas do dia (provável `useMinhasTarefas` ou similar).
3. Conferir lógica atual: filtro só por responsável vs. inclusão de pool de base.
4. Validar via `useAlocacaoDiaria` se a tela já sabe que o técnico está em modo base.
5. Checar RLS de `vistorias` / `servicos` / `agendamentos_base` para o role profissional.

## Plano de correção

### 1) Hook de listagem ciente da alocação

Ajustar (ou criar) hook `useMinhasTarefasHoje` que combina:

- **Sempre:** vistorias/serviços onde `vistoriador_id = profile.id` ou `instalador_responsavel_id = profile.id` agendadas para hoje.
- **Quando `useAlocacaoDiaria.isBase === true`:** UNIR com todas as vistorias de **base** agendadas para hoje sem vistoriador atribuído (`vistoriador_id IS NULL` E `local_atendimento = 'base'` ou via `agendamentos_base.data = hoje`).

Usar `getHojeBrasilia` + `format(..., 'yyyy-MM-dd')` para o filtro de data, blindando timezone (mesmo padrão já consolidado em `useAlocacaoDiaria` e `date-utils`).

### 2) Tela "Minhas Tarefas"

- Mostrar seção **"Vistorias da Base — Hoje"** quando `isBase`, listando o pool inteiro com badge "Disponível".
- Botão **"Pegar e Iniciar"** em cada item: chama edge/mutation que atribui `vistoriador_id = profile.id` e marca `iniciada_em = now()` (atomicamente, para evitar dois técnicos pegarem a mesma).
- Vistorias já atribuídas a ele continuam aparecendo numa seção "Minhas atribuídas" com botão "Continuar".

### 3) Edge / mutation de "pegar vistoria"

Criar (ou reaproveitar) `pegar-vistoria-base`:
- Verifica que `vistoriador_id IS NULL` (lock otimista) antes de atribuir.
- Atualiza `vistorias`, `servicos` e `agendamentos_base` correspondentes.
- Retorna o ID resolvido para navegação direta para `ExecutarVistoriaCompleta`.

### 4) RLS

Garantir que profissionais com role vistoriador/instalador conseguem **SELECT** em vistorias de base do dia mesmo sem vínculo direto (filtro por `data_agendada = today` AND `tipo = 'base'` AND `vistoriador_id IS NULL`). Se já existir policy restritiva, criar uma policy adicional cobrindo esse caso.

### 5) UX / mensagens

- Header da tela: badge "Você está na BASE hoje" quando `isBase`.
- Estado vazio diferenciado: "Nenhuma vistoria de base para hoje" vs. "Nenhuma tarefa atribuída".
- Ao concluir uma vistoria, voltar automaticamente para a lista para o técnico pegar a próxima.

## Não vou mexer

- Fluxo de execução em si (`ExecutarVistoriaCompleta` continua igual).
- Mapa de monitoramento — atribuição manual via drag continua funcionando para casos especiais.
- Lógica de `useAlocacaoDiaria` (já está correta).
- Vistorias de rota (técnico em rota só vê o que foi atribuído explicitamente).

## Resultado

Wallace (e qualquer técnico em modo base) abre o app e vê **toda a fila de vistorias da base do dia**, pega uma, executa, conclui, volta pra lista e pega a próxima — sem depender de atribuição manual pelo monitoramento.
