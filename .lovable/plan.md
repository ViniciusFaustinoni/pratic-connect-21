
# Modulo Juridico — Dashboard de Casos + Lista de Casos + Perfil Advogado

## Resumo

Adicionar o perfil "advogado" ao sistema, criar a pagina "Casos" (casos juridicos originados de eventos/sindicancias), e enriquecer o Dashboard Juridico com KPIs focados nesses casos. Adicionar submenu "Casos" no sidebar.

## Migracao de Banco

Adicionar `advogado` ao enum `app_role`:

```text
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'advogado';
```

## Arquivos a Criar

### 1. `src/pages/juridico/CasosJuridicosList.tsx`

Pagina de lista unificada de casos juridicos originados de eventos. A fonte de dados principal e a tabela `consultas_juridicas` onde `sinistro_id IS NOT NULL`, complementada por `processos` onde `sinistro_id IS NOT NULL` (criados por sindicancias com resultado irregular/juridico).

**Tabela:**
- Colunas: numero do caso (link para detalhe da consulta ou processo), tipo (badge colorido baseado no assunto — fraude, carta cancelamento, questao legal, indenizacao, etc.), origem (badge: "Sindicancia" se veio de resultado de sindicancia, "Encaminhamento" se veio direto da analise, "Analise Interna" se departamento=analise_interna), associado (nome via join com associados), placa (via join sinistro -> veiculo), protocolo do evento (link para /eventos/sinistros/:sinistro_id), advogado responsavel (via respondido_por em consultas ou advogado em processos), prioridade (badge), status (badge), dias aberto (differenceInDays entre created_at e hoje), ultima atualizacao (updated_at formatada)
- Query unificada: busca em `consultas_juridicas` com `sinistro_id IS NOT NULL` fazendo join com sinistros (protocolo, veiculo_id, associado_id), associados (nome), veiculos (placa, modelo), profiles (respondido_por para nome do advogado)
- Tambem busca em `processos` com `sinistro_id IS NOT NULL` com joins similares
- Resultados combinados e ordenados por prioridade (urgente primeiro) e depois por data de criacao (mais recentes primeiro)
- Filtros: status (pendente, em_analise, respondida, arquivada, ativo, suspenso), tipo, prioridade, advogado/responsavel, periodo, busca textual por numero/nome/placa
- Nao tem botao de criar — casos nascem automaticamente

**Determinacao de origem:**
- Se consulta tem `departamento = 'eventos'` e o assunto contem "Sindicancia" -> origem = "Sindicancia"
- Se consulta tem `departamento = 'eventos'` e assunto contem "Encaminhamento" -> origem = "Encaminhamento"
- Se consulta tem `departamento = 'analise_interna'` -> origem = "Analise Interna"
- Para processos com `tipo = 'sindicancia_fraude'` ou `sindicancia_complexa` -> origem = "Sindicancia"

**Tipos para badges coloridos:**
- `sindicancia_fraude` / assunto contem "Fraude" -> vermelho, label "Fraude"
- assunto contem "Carta de Cancelamento" -> laranja, label "Carta Cancel."
- assunto contem "Encaminhamento Juridico" -> roxo, label "Questao Legal"
- assunto contem "indenizacao" ou "Indenizacao" -> azul, label "Indenizacao"
- assunto contem "alagamento" ou "incendio" -> amarelo, label "Analise Tecnica"
- padrao -> cinza, label "Outro"

## Arquivos a Modificar

### 2. Enriquecer `src/pages/juridico/JuridicoDashboard.tsx`

Adicionar uma nova linha de 5 KPI cards ACIMA da linha existente, focada em casos de eventos:

**Novos 5 KPI Cards (linha 1):**
- "Casos Abertos" — count de consultas_juridicas onde sinistro_id IS NOT NULL e status IN ('pendente', 'em_analise') MAIS processos onde sinistro_id IS NOT NULL e status = 'ativo'. Cor ambar.
- "Aguardando Parecer" — count de consultas_juridicas onde sinistro_id IS NOT NULL e status = 'pendente' (advogado ainda nao analisou). Cor vermelha se > 0.
- "Fraudes este Ano" — count de processos onde tipo = 'sindicancia_fraude' e created_at no ano corrente. Cor vermelha.
- "Aguardando Diretoria" — count de sinistros onde status = 'suspenso' e motivo_suspensao contendo 'diretoria' ou resultado_sindicancia = 'inconclusivo'. Cor amarela.
- "Finalizados este Mes" — count de consultas_juridicas onde sinistro_id IS NOT NULL e status = 'respondida' e respondido_em no mes corrente MAIS processos onde sinistro_id IS NOT NULL e status em lista de encerrados e updated_at no mes. Cor verde.

**Grafico de rosca** — distribuicao dos casos abertos por tipo (fraude, carta cancelamento, questao legal, indenizacao, analise tecnica, outro). Usar Recharts PieChart.

**Grafico de barras** — evolucao mensal dos ultimos 6 meses: total de casos criados por mes. Usar Recharts BarChart.

**Lista de casos urgentes** — consultas_juridicas com sinistro_id IS NOT NULL e prioridade IN ('alta', 'urgente') e status IN ('pendente', 'em_analise'), mostradas como cards clicaveis que levam para /juridico/consultas/:id.

Manter toda a secao existente do dashboard (processos, prazos, audiencias, andamentos) abaixo, separada por um Separator com label "Processos Judiciais".

### 3. Modificar `src/hooks/usePermissions.ts`

Na linha que define `canManageJuridico`, adicionar `hasRole('advogado')`:

```text
canManageJuridico: isDiretor || hasRole('gerente_comercial') || hasRole('analista_juridico') || hasRole('advogado') || isDesenvolvedor,
```

### 4. Modificar `src/components/layout/AppSidebar.tsx`

Adicionar item "Casos" no grupo `juridico`, logo apos Dashboard:

```text
items: [
  { title: 'Dashboard', url: '/juridico', icon: BarChart3 },
  { title: 'Casos', url: '/juridico/casos', icon: FileText },  // NOVO
  { title: 'Processos', url: '/juridico/processos', icon: FileText },
  ...
]
```

### 5. Modificar `src/App.tsx`

Adicionar rota:

```text
<Route path="/juridico/casos" element={<CasosJuridicosList />} />
```

### 6. Atualizar `src/pages/configuracoes/Perfis.tsx` e `src/pages/diretoria/PerfisAcesso.tsx`

Adicionar o perfil `advogado` na lista de perfis com:
- label: 'Advogado'
- sigla: 'Adv'
- color: azul escuro
- area: 'Juridico'
- descricao: 'Advogado com acesso ao modulo juridico'

### 7. Atualizar `src/types/database.ts` (ROLE_LABELS)

Adicionar entrada para o novo role:

```text
advogado: 'Advogado',
```

## Detalhes Tecnicos

- A query de casos unificada combina resultados de `consultas_juridicas` e `processos`, ambos filtrados por `sinistro_id IS NOT NULL`
- Cada fonte recebe um campo virtual `_source: 'consulta' | 'processo'` para diferenciar no frontend
- O link do numero do caso leva para `/juridico/consultas/:id` (consultas) ou `/juridico/processos/:id` (processos)
- O link do protocolo do evento leva para `/eventos/sinistros/:sinistro_id`
- Dias aberto calculado com `differenceInDays(new Date(), new Date(created_at))`
- Graficos usam Recharts (PieChart e BarChart), ja instalado no projeto
- Nao e necessaria nenhuma nova tabela — toda a informacao ja existe em consultas_juridicas e processos

## Ordem de Implementacao

1. Migracao: adicionar `advogado` ao enum `app_role`
2. `CasosJuridicosList.tsx` — criar pagina de lista
3. `JuridicoDashboard.tsx` — enriquecer com novos KPIs, graficos e lista urgente
4. `usePermissions.ts` — adicionar role advogado
5. `AppSidebar.tsx` — adicionar submenu Casos
6. `App.tsx` — adicionar rota
7. `Perfis.tsx`, `PerfisAcesso.tsx`, `database.ts` — registrar novo perfil
