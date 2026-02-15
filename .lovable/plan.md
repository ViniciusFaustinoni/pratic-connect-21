

# Nova Area de Alertas em Monitoramento

## Resumo

Criar uma nova pagina dedicada `/monitoramento/alertas` dentro do modulo de Monitoramento que exibe todos os alertas recebidos via webhook da Softruck e de outras fontes. Essa pagina sera uma versao completa e expandida do widget `AlertasWidget` que ja existe no dashboard do coordenador.

Alem disso, o webhook `softruck-webhook` sera atualizado para suportar os novos tipos de eventos fornecidos pela Softruck (Service Orders, Provider, Section, Custom Fields, Completion, Acknowledgement).

## O que ja existe

- Tabela `rastreador_alertas` com campos: id, rastreador_id, tipo, severidade, mensagem, dados, status, tratado_por, tratado_em, observacao_tratamento
- Tabela `softruck_eventos` que registra todos os webhooks recebidos
- View `view_alertas_ativos` usada pelo `AlertasWidget`
- Edge Function `softruck-webhook` que ja processa DEVICES.ASSOCIATED, DEVICES.DISASSOCIATED, VEHICLES.CREATED, VEHICLES.DELETED e device-events
- Componente `AlertasWidget` (widget compacto usado no dashboard)
- Componente `SoftruckWebhooksPanel` (painel tecnico de eventos)

## Alteracoes

### 1. Nova pagina: `src/pages/monitoramento/AlertasMonitoramento.tsx`

Pagina completa de alertas com:
- Cards de metricas no topo (total abertos, criticos, visualizados, tratados hoje)
- Filtros: por tipo (sem_comunicacao, bateria_baixa, desinstalacao, offline, veiculo_removido, os_atualizada, os_concluida, device_associado, device_desassociado), por severidade (critica, alta, media, baixa), por status (aberto, visualizado, tratado, ignorado)
- Lista de alertas com acoes (visualizar, tratar, ignorar, WhatsApp)
- Cada alerta mostra: placa/rastreador, associado, tipo, severidade, mensagem, tempo decorrido
- Usa a mesma `view_alertas_ativos` e tabela `rastreador_alertas`
- Opcao de ver tambem alertas ja tratados/ignorados (toggle "Mostrar todos")

### 2. Atualizar Edge Function `softruck-webhook`

Adicionar handlers para os novos tipos de eventos:
- `TASKS.UPDATED` / `TASKS.DELETED` - Ordem de servico atualizada/removida
- `TASKS.COMPLETED` / `TASKS.UNCOMPLETED` - OS concluida/reaberta
- `TASKS.ASSIGNEE_UPDATED` / `TASKS.ASSIGNEE_DELETED` - Prestador atualizado
- `TASKS.SECTION_UPDATED` / `TASKS.SECTION_DELETED` - Secao da OS
- `TASKS.CUSTOM_FIELDS_UPDATED` / `TASKS.CUSTOM_FIELDS_DELETED` - Campos customizados
- `TASKS.ACKNOWLEDGEMENT_UPDATED` / `TASKS.ACKNOWLEDGEMENT_DELETED` - Ciencia de OS
- `DEVICES.ASSOCIATED` / `DEVICES.ASSOCIATION_UPDATED` / `DEVICES.DISASSOCIATED` (ja existem parcialmente)

Para cada tipo, o webhook:
1. Ja registra na `softruck_eventos` (isso ja funciona para qualquer payload)
2. Cria alerta na `rastreador_alertas` com tipo e severidade adequados
3. Extrai dados relevantes do `data.params` (formato padrao Softruck)

A estrutura de payload da Softruck segue o padrao `{ data: { type: "TIPO", platform: "WEBHOOK", params: { ... } } }`, entao o parser sera atualizado para reconhecer esse formato.

### 3. Atualizar rota e menu lateral

- Adicionar rota `/monitoramento/alertas` no `App.tsx`
- Adicionar item "Alertas" no sidebar em `AppSidebar.tsx` (com icone Bell, dentro do grupo Monitoramento)
- Adicionar breadcrumb em `GlobalBreadcrumb.tsx`

### 4. Atualizar `AlertasWidget` no dashboard

Adicionar botao "Ver todos" que navega para `/monitoramento/alertas`

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `src/pages/monitoramento/AlertasMonitoramento.tsx` | NOVO - pagina completa de alertas |
| `supabase/functions/softruck-webhook/index.ts` | Atualizar parser e adicionar handlers para novos eventos |
| `src/App.tsx` | Adicionar rota /monitoramento/alertas |
| `src/components/layout/AppSidebar.tsx` | Adicionar item "Alertas" no menu |
| `src/components/layout/GlobalBreadcrumb.tsx` | Adicionar breadcrumb |
| `src/components/monitoramento/AlertasWidget.tsx` | Adicionar botao "Ver todos" |

## Detalhes tecnicos

### Parser atualizado do webhook

O webhook atualmente espera `payload.event` ou `payload.type`. O formato Softruck usa `payload.data.type`. O parser sera atualizado:

```text
eventoTipo = payload.event 
          || payload.type 
          || payload.data?.type    // <-- novo
          || "unknown"
```

Os `params` virao de `payload.data?.params` em vez de campos raiz.

### Mapeamento de severidade dos novos eventos

| Evento | Tipo alerta | Severidade |
|---|---|---|
| TASKS.COMPLETED | os_concluida | baixa (informativo) |
| TASKS.DELETED | os_removida | media |
| TASKS.UPDATED | os_atualizada | baixa |
| TASKS.UNCOMPLETED | os_reaberta | media |
| TASKS.ASSIGNEE_UPDATED | prestador_atualizado | baixa |
| TASKS.ACKNOWLEDGEMENT_UPDATED | ciencia_os | baixa |
| DEVICES.ASSOCIATED | device_associado | baixa |
| DEVICES.ASSOCIATION_UPDATED | device_atualizado | baixa |
| DEVICES.DISASSOCIATED | desinstalacao | critica (ja existe) |
| VEHICLES.CREATED | veiculo_criado | baixa (ja existe sem alerta) |
| VEHICLES.DELETED | veiculo_removido | alta (ja existe) |

### Migracao de banco

Adicionar coluna `titulo` e `veiculo_id` na tabela `rastreador_alertas` (o webhook ja tenta inserir esses campos mas eles nao existem na tabela). Tambem tornar `rastreador_id` nullable para alertas de veiculo sem rastreador associado. Adicionar coluna `dados_extras` (jsonb).

