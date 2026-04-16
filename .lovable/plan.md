

## Entendimento

Manter a tela atual `/monitoramento/equipe` → aba **Plantões** funcionando como está. Apenas garantir que **todo técnico marcado como plantonista naquele dia seja automaticamente tratado como tipo BASE** no resto do sistema (mapa, atribuições, regras de serviço).

Sem unificar com calendário do mapa, sem remover rotas, sem mexer em UI. Mudança puramente de **lógica de sincronização**.

## Investigação necessária (próxima rodada)

1. Ler `PlantoesCalendario.tsx` e ver onde grava plantão (tabela `plantoes`? `escalas`?).
2. Confirmar schema da tabela de plantões (tem `base_id`? qual coluna identifica o dia e o técnico?).
3. Ver se já existe trigger/sync entre `plantoes` e `alocacoes_diarias`.

## Plano

### 1) Trigger no banco: plantão → alocação BASE automática

Criar trigger `AFTER INSERT/UPDATE/DELETE` na tabela de plantões que faz upsert/delete em `alocacoes_diarias`:

- **INSERT/UPDATE plantão** → upsert em `alocacoes_diarias` com:
  - `profissional_id` = técnico do plantão
  - `data` = dia do plantão
  - `tipo_alocacao = 'base'`
  - `base_id` = base do plantão (se a tabela tiver; senão usar base default ou pedir ao usuário)
  - `definido_por = 'plantao_auto'` (marcador de origem)
  - `observacoes = 'Plantão automático'`

- **DELETE plantão** → remover a `alocacoes_diarias` correspondente (somente se `definido_por='plantao_auto'`, para não apagar override manual).

### 2) Conflito com override manual

Se coordenador já marcou o técnico como **rota** manualmente naquele dia (via `AlocarVistoriadorDialog`), o plantão **não sobrescreve** — `definido_por` diferente de `plantao_auto` significa decisão humana e tem prioridade.

Regra do upsert: usar `ON CONFLICT (profissional_id, data) DO UPDATE` com `WHERE alocacoes_diarias.definido_por = 'plantao_auto' OR alocacoes_diarias.definido_por IS NULL`.

### 3) Backfill dos plantões existentes

Migration roda uma única vez: para cada plantão já cadastrado (incluindo o WALLACE de 11/abr da screenshot), gera a `alocacoes_diarias` correspondente.

### 4) Pergunta de schema

Se a tabela de plantões **não tiver `base_id`**, preciso definir como descobrir a base. Opções:
- (a) Adicionar coluna `base_id` na tabela de plantões (preferível).
- (b) Usar uma base default global.
- (c) Pedir ao coordenador escolher base ao criar plantão.

Vou investigar primeiro; se faltar, sigo pela opção (a) com migration adicionando a coluna + select de base no formulário de criação de plantão.

## Resultado

Coordenador continua usando a aba **Plantões** exatamente como hoje. Por baixo, todo plantão vira automaticamente uma alocação `tipo_alocacao='base'` no dia, fazendo o técnico:
- Sumir do mapa de rota.
- Receber só vistorias da base.
- Aparecer no popup do ícone da base.

Override manual via `AlocarVistoriadorDialog` continua tendo prioridade sobre o plantão.

