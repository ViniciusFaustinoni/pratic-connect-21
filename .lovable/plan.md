

# Implementação do Módulo de Comissões — Plano em 4 Fases

## Diagnóstico do que já existe
- **Tabelas DB**: `grades_comissao` (3 registros), `grades_comissao_niveis` (com `role`, `percentual`), `usuario_grade_comissao` (5 vínculos), `comissoes` (24 registros — já tem `parcela_numero`, `parcela_total`, `cobranca_id`, `tipo_comissao`, `status`, `nivel_nome`), `comissoes_pagamentos`, `comissoes_recorrentes`, `comissao_plano_nivel`.
- **Hierarquia atual**: grade tem N níveis cada um com **% único** e um `role`. Não há conceito de **parcela** (adesão / 2ª / Nª / vitalícia) na grade.
- **UI atual**: `/configuracoes/grades-comissao` (lista), `/configuracoes/grades-comissao/nova` (form simples só com %), `/financeiro/configuracoes/comissionamento-externo` (tela legada — a remover).
- **Roles disponíveis** (enum `app_role`): `vendedor_clt`, `vendedor_externo`, `agencia`, `supervisor_vendas`, `gerente_comercial`, `diretor`. Já existem.

## É necessário fasear?
**Sim — 4 fases.** A mudança no modelo da grade (adicionar parcelas) impacta cálculo, geração e relatórios. Tentar tudo de uma vez quebra o financeiro existente e impede QA por etapa.

---

## Fase 1 — Modelo de Dados + Refator da Grade
**Objetivo**: novo modelo "grade por parcela", sem mexer no cálculo ainda.

### Banco
1. Nova tabela `grades_comissao_parcelas`:
   - `id`, `grade_id` (FK), `numero_parcela` (int, 1=adesão, 2=2ª mensalidade, …), `vitalicia` (bool, default false), `label` (text — ex: "Taxa de Adesão", "Vitalícia"), `ordem`.
   - Unique: `(grade_id, numero_parcela)` quando `vitalicia=false`; máx. 1 vitalícia por grade.
2. Refator `grades_comissao_niveis`:
   - Adicionar `parcela_id` (FK → `grades_comissao_parcelas`, nullable durante migração).
   - Manter `percentual`, `role`, `nome`, `ordem`.
   - Migração de dados: para cada grade existente, criar 1 parcela "Taxa de Adesão" (numero=1) e vincular todos os níveis atuais a ela (preserva comportamento).
3. Adicionar coluna `versao` (int) e `vigente_desde` (timestamp) em `grades_comissao` para suportar a regra **"alterações só valem para novas vendas"** sem retroatividade.
4. Adicionar `grade_versao_id` (FK ou snapshot jsonb) em `comissoes` para travar a versão usada na geração.

### UI — `/configuracoes/grades-comissao` (refeita)
- Lista igual, mas card mostra: nº parcelas configuradas + se tem vitalícia.
- Form (`GradeComissaoForm.tsx`) reescrito:
  - Seção "Parcelas" com botão **"Adicionar parcela"** e **"Adicionar parcela vitalícia"**.
  - Cada parcela é um bloco expansível com: label (ex: "Taxa de Adesão"), nº parcela (auto), tabela de níveis (role + nome + %), barra de progresso (total ≤100%, restante = empresa).
  - Tooltip explicando que "vitalícia" começa a partir da parcela X e pega todos os pagamentos seguintes.
  - Aviso visual fixo: *"Alterações só valem para novas vendas a partir do salvamento. Comissões já geradas não mudam."*
- Quando salva edição, cria nova versão (incrementa `versao`, mantém histórico).

**Deliverable da fase**: diretor consegue criar/editar grade com várias parcelas + vitalícia. Cálculo ainda não usa parcelas (ainda gera só na adesão como hoje).

---

## Fase 2 — Atribuição de Grades + Hierarquia de Vendas
**Objetivo**: vincular vendedores/supervisores/gerentes/agências às grades.

### Banco
- `usuario_grade_comissao` já existe (1 grade ativa por usuário). Adicionar:
  - `data_inicio`, `data_fim` (nullable) para histórico.
  - `papel_no_nivel` (text, nullable) — qual nível da grade aquele usuário ocupa quando a grade tem dois níveis do mesmo `role` (caso raro).
- Nova tabela `hierarquia_vendas`:
  - `vendedor_id` (uuid, profile), `supervisor_id` (uuid, nullable), `gerente_id` (uuid, nullable), `agencia_id` (uuid, nullable), `vigente_desde`, `vigente_ate`.
  - Permite resolver, dada uma venda do vendedor X, **quem é o supervisor/gerente naquele momento** — fundamental para gerar comissões para níveis superiores.

### UI — nova tela `/comissoes/atribuicao`
- Tabela com: usuário, role, grade atual, supervisor, gerente, agência.
- Modal de edição: selects para grade + supervisor + gerente + agência (filtrados por role).
- Bulk: filtrar por role e atribuir grade em massa.

**Deliverable da fase**: cada vendedor/supervisor/gerente/agência tem grade + cadeia hierárquica registrada.

---

## Fase 3 — Motor de Cálculo + Geração de Comissões por Parcela
**Objetivo**: gerar comissões corretamente respeitando parcela e vitalícia, no momento certo (adesão = na criação do contrato; demais = ao reconhecer pagamento).

### Banco / Edge Functions
1. Função `fn_gerar_comissoes_por_pagamento(p_cobranca_id uuid)`:
   - Identifica contrato → vendedor → versão da grade vigente no momento da venda (snapshot em `comissoes.grade_versao_id`).
   - Determina `numero_parcela` da cobrança paga (1=adesão, 2=2ª mens., …).
   - Procura na grade a parcela correspondente; se não existir e houver vitalícia ativa **e** o número da parcela ≥ início da vitalícia, usa a vitalícia.
   - Para cada nível dessa parcela: resolve o usuário pela `hierarquia_vendas` (vendedor→ele mesmo; supervisor→supervisor_id; gerente→gerente_id; agencia→agencia_id) e insere linha em `comissoes` com `valor_base` = valor pago, `percentual_aplicado`, `valor_comissao`, `nivel_nome`, `parcela_numero`, `cobranca_id`, status `pendente`.
   - Idempotência: unique `(cobranca_id, vendedor_id, nivel_nome)` evita duplicação.
2. Triggers/hooks de disparo:
   - **Adesão**: na criação do contrato (já há fluxo) → cria cobrança de adesão → quando paga → dispara função.
   - **Mensalidades**: trigger em `cobrancas` quando `status` muda para "pago" / `data_pagamento` é setada (via Asaas webhook ou sync SGA Hinova).
3. Backfill opcional: rodar para cobranças já pagas que ainda não geraram comissão (controlado por flag).

**Deliverable da fase**: ao pagar qualquer parcela, comissões corretas são geradas para todos os níveis da grade (vendedor + supervisor + gerente + agência), incluindo vitalícia.

---

## Fase 4 — Menu "Comissões" no Administrativo + Dashboard + Cleanup
**Objetivo**: UI de consumo para diretor + financeiro + remoção da tela legada.

### Sidebar
- Novo grupo no menu **Administrativo** (ou item top-level "Comissões" se preferido — confirmar):
  - **Dashboard de Comissões** → `/comissoes`
  - **Grades de Comissão** → `/comissoes/grades` (move de `/configuracoes/grades-comissao`)
  - **Atribuição de Grades** → `/comissoes/atribuicao`
  - **Pagamentos** → `/comissoes/pagamentos` (lista, marcar como pago, comprovante)
- Permissão: `isDiretor || isGerencia` para ver; ações de criação/edição só para `isDiretor`.

### Dashboard `/comissoes`
- KPIs (cards clicáveis):
  - **Total a pagar este mês** (status `pendente` + `aprovada`)
  - **Total pago no mês**
  - **Pendente de aprovação**
  - **Top 5 vendedores do mês**
  - **Comissões vitalícias ativas** (contagem)
- Cada card abre **modal de detalhes** com tabela: usuário, valor, parcela, contrato, cobrança, status, ações (aprovar / pagar / contestar).
- Filtros: período, role, grade, status.

### Cleanup
- Remover `/financeiro/configuracoes/comissionamento-externo` (rota, página, hook `useComissaoExternaConfig`, item no `AppSidebar`, `GlobalBreadcrumb`).
- Deprecar `comissao_plano_nivel` e `ComissionamentoPlano.tsx` (a grade nova substitui).
- Manter `useContaCorrenteVendedor` mas trocar dependência de `useComissaoExternaConfig` por leitura da grade do vendedor.
- Redirect `/configuracoes/grades-comissao*` → `/comissoes/grades*` para não quebrar bookmarks.

**Deliverable da fase**: módulo "Comissões" funcional ponta-a-ponta; tela legada extinta.

---

## Detalhes técnicos consolidados

### Snapshot de versão (não-retroatividade)
Cada `comissoes` carrega `grade_versao_id` (FK para uma tabela `grades_comissao_versoes` que guarda jsonb da grade no momento). Recálculo futuro sempre lê esse snapshot, nunca a grade atual. Isso satisfaz a regra "alterações só valem para novas vendas".

### Resolução da hierarquia em runtime
Função `fn_resolver_cadeia(vendedor_id, data_referencia)` retorna `{vendedor_id, supervisor_id, gerente_id, agencia_id}` consultando `hierarquia_vendas` vigente naquela data. Usada pela geração para mapear níveis da grade aos usuários reais.

### Reconhecimento de pagamento
- Asaas: webhook já existente atualiza `cobrancas.status='pago'` → trigger gera comissão.
- SGA Hinova: a sync financeira (já com janela de 5 meses) também marca cobranças como pagas → mesmo trigger.

### Permissões
- `isDiretor`: criar/editar grades, atribuir, ver tudo.
- `isGerencia` (financeiro): ver dashboard, marcar como pago.
- `vendedor_*`, `supervisor_vendas`, `gerente_comercial`, `agencia`: ver **apenas suas próprias** comissões em `/perfil/conta-corrente` (já existe).

### Estrutura de arquivos nova
```text
src/pages/comissoes/
  ComissoesLayout.tsx
  Dashboard.tsx
  Grades.tsx                 (movido)
  GradeForm.tsx              (refeito, com parcelas)
  Atribuicao.tsx             (nova)
  Pagamentos.tsx             (nova)
src/components/comissoes/
  ParcelaEditor.tsx          (bloco de parcela com níveis)
  KpiCard.tsx
  ComissoesDetalhesModal.tsx
  AtribuirGradeModal.tsx
  HierarquiaVendasModal.tsx
src/hooks/
  useGradesComissaoV2.ts
  useHierarquiaVendas.ts
  useComissoesDashboard.ts
supabase/functions/
  comissoes-gerar-por-pagamento/   (nova)
  (manter calcular-comissoes-mensais como agregador histórico)
```

### Migrações DB (resumo)
- Fase 1: criar `grades_comissao_parcelas`, `grades_comissao_versoes`; alterar `grades_comissao_niveis` (+`parcela_id`); alterar `grades_comissao` (+`versao`,`vigente_desde`); alterar `comissoes` (+`grade_versao_id`); migração de dados das grades existentes.
- Fase 2: criar `hierarquia_vendas`; alterar `usuario_grade_comissao` (+`data_inicio`,`data_fim`,`papel_no_nivel`).
- Fase 3: criar `fn_gerar_comissoes_por_pagamento`, `fn_resolver_cadeia`; trigger `trg_gerar_comissoes_em_pagamento` em `cobrancas`.
- Fase 4: nada estrutural — só drop da config legada após confirmação.

---

## Pergunta antes da Fase 1
1. **"Vitalícia" começa a partir de qual parcela por padrão?** (opções: a partir da parcela seguinte à última configurada / a partir de uma parcela X escolhida pelo diretor / sempre a partir da 2ª — sugiro **deixar o diretor escolher o número de início**).
2. **Onde fica o menu "Comissões"?** Top-level próprio ou submenu dentro de **Administrativo**? (sugiro top-level com permissão `isDiretor||isGerencia` — mais visível).
3. **Cleanup do `/financeiro/configuracoes/comissionamento-externo` e `comissao_plano_nivel`**: posso remover de fato na Fase 4, ou só ocultar do menu mantendo as tabelas como legado?

Aprovação da Fase 1 já é suficiente para começar; as fases 2–4 entram em sequência conforme cada uma for validada.

