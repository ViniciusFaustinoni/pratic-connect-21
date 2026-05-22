
## Mapeamento do que já existe (código real, não suposição)

**Consultor — `/vendas/cotacoes` (`src/pages/vendas/Cotacoes.tsx` + `src/components/cotacoes/CotacoesTable.tsx` + `CotacoesMobileList.tsx`)**
- Mostra badge "Etapa da Venda" derivada de `getEtapaVenda()` em `src/lib/cotacaoEtapa.ts` (16 estágios: cotacao_realizada, escolhendo_plano, enviando_documentos, escolha_vistoria, realizando_autovistoria, assinando_contrato, realizando_pagamento, aguardando_vistoria, vistoria_agendada, instalacao_agendada, etc.).
- Tem bolinha pulsante âmbar/vermelha `FlagTravada` (`src/components/cotacoes/FlagTravada.tsx`) que consulta `getCotacaoTravada()` em `src/lib/cotacaoTravada.ts`. Hoje **só dispara para contratos `assinado` ou `ativo`** (linha 71 do arquivo) — cotações paradas ANTES da assinatura (plano/docs/contrato) mostram a etapa mas sem sinal de "parado".
- Filtro "Apenas travadas" e contador já existem (`Cotacoes.tsx` linhas 338 e 982).

**Cadastro — `/cadastro/propostas-pendentes` (`src/pages/cadastro/PropostasPendentes.tsx`, hook `src/hooks/usePropostasPendentes.ts`)**
- Query base filtra `contratos` com `.eq('status', 'assinado')` (linha 347 do hook). **Cotações com link público incompleto, onde o contrato ainda não foi assinado, simplesmente não entram nessa lista** — Cadastro não vê o caso.
- Pós-assinatura há badges granulares funcionando: "Aguard. Doc", "Pendente Vistoria Inicial", "Aguard. Vistoria", "Aguard. Instalação", "Agendado" (funções `isPendenteVistoriaInicial`, `isAguardandoDoc` etc. nas linhas 107–135).
- Dashboard do Cadastro (`src/components/cadastro/DashboardCadastro.tsx`) não tem KPI de "parados no link público".

**Monitoramento — `/monitoramento/vistorias-instalacoes-mon` (`src/pages/monitoramento/ServicosCampoUnificado.tsx`, `AprovacaoInstalacaoDetalhe.tsx`)**
- Trabalha em cima de `servicos`/`instalacoes`/`agendamentos_base` materializados. Casos parados no link público **não chegam até aqui** (não há agendamento, não há instalação) e não têm sinalização própria.
- O guard backend `caminho_publico_incompleto` já existe em `supabase/functions/aprovar-proposta/index.ts` (linhas 290–388) com motivos canônicos: `sem_vistoria`, `vistoria_incompleta`, `sem_agendamento`, `agendamento_base`. Mas a mensagem vai pro toast com texto cru — sem o vocabulário canônico das telas.

Conclusão: o Consultor enxerga parcialmente (só pós-assinatura); o Cadastro é cego pré-assinatura; o Monitoramento só ouve o guard via erro de toast.

---

## O que vai ser feito

### 1. Fonte única de vocabulário (lib pura, sem UI)
Novo `src/lib/etapaPendentePublica.ts` que recebe uma cotação e devolve `{ codigo, label, descricao_associado, cobrar }`. Conjunto canônico:

- `aguardando_escolha_plano`
- `aguardando_documentos`
- `aguardando_assinatura_contrato`
- `aguardando_pagamento_adesao`
- `aguardando_escolha_vistoria`
- `aguardando_autovistoria`
- `aguardando_agendamento_instalacao`
- `aguardando_execucao_agendada`
- `nenhuma` (caso completou tudo / caso fora do escopo)

Cada código mapeia 1‑pra‑1 contra as etapas que `getEtapaVenda()` já devolve e contra os motivos do guard backend (`sem_vistoria` → `aguardando_autovistoria`, `sem_agendamento` → `aguardando_agendamento_instalacao`, etc.). Essa lib é a única fonte de label nas três telas.

### 2. Consultor — estender o que já existe (sem nova UI)
- Em `src/lib/cotacaoTravada.ts`, remover o gate `contratoStatus in [assinado, ativo]` e adicionar SLAs para as etapas pré‑assinatura (`escolhendo_plano`, `enviando_documentos`, `assinando_contrato`). Mesmas faixas amarelo/vermelho.
- Tooltip da `FlagTravada` passa a usar `etapaPendentePublica.label` em vez de string ad‑hoc — vocabulário fica idêntico ao do Cadastro.
- Filtro "Apenas travadas" e contador já existentes em `Cotacoes.tsx` passam a cobrir também o pré‑assinatura sem mudança adicional.

### 3. Cadastro — nova aba "Link Público Incompleto" em `PropostasPendentes.tsx`
- Novo hook `src/hooks/useCotacoesLinkPublicoIncompleto.ts`: lista cotações com `status_contratacao` ativo (cliente já entrou no link) e SEM `contrato.status='assinado'`. Computa `etapaPendentePublica` por linha.
- Nova aba no topo da página `PropostasPendentes.tsx` ("Em análise" — atual padrão — / "Link Público Incompleto" — nova) reusando os mesmos componentes de tabela, filtros e ordenação que a aba atual usa (sem componente novo). Colunas: associado, veículo, plano, vendedor, etapa pendente (label canônico), tempo na etapa (com cor de SLA — verde/amarelo/vermelho usando as mesmas funções `getWaitColor`/`getWaitTextColor`).
- KPI no `DashboardCadastro.tsx`: novo `KPICard` "Parados no link público" com mesma cor de SLA. Clique abre a nova aba.
- Realtime: o hook se invalida pelos mesmos canais que `usePropostasPendentes` já escuta (cotações + contratos). Quando o contrato for assinado, o caso some da nova aba e cai na fila normal sem ação manual.

### 4. Monitoramento — consistência, sem nova listagem
- Casos parados no Cadastro / link público NÃO ganham nova lista no Monitoramento (decisão consciente: não é a responsabilidade do papel e polui a fila). 
- O que muda: em `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx`, quando o `aprovar-proposta` retorna `caminho_publico_incompleto` / `sem_agendamento` / `sem_vistoria_materializada`, a mensagem de erro é traduzida via `etapaPendentePublica` (mesma label que o Consultor e o Cadastro veem). Vocabulário fica unificado nas três telas.

### 5. Validação ao terminar
- Caso novo entra no link público e para em "Documentos" → aparece em `/vendas/cotacoes` com badge "Enviando Documentos" + bolinha pulsante (SLA pré‑assinatura) e em `/cadastro/propostas-pendentes` aba "Link Público Incompleto" com a mesma label "Aguardando documentos".
- Cliente envia os documentos e assina → caso some das duas telas e entra na fila normal de análise do Cadastro automaticamente (invalidação já existente).
- Se o Monitoramento for tentar aprovar prematuramente, o toast de erro usa exatamente a mesma label.

### Detalhes técnicos
- Arquivos novos: `src/lib/etapaPendentePublica.ts`, `src/hooks/useCotacoesLinkPublicoIncompleto.ts`.
- Arquivos alterados: `src/lib/cotacaoTravada.ts` (estender SLAs pré‑assinatura), `src/components/cotacoes/FlagTravada.tsx` (label canônica no tooltip), `src/pages/cadastro/PropostasPendentes.tsx` (adicionar Tabs com nova aba), `src/components/cadastro/DashboardCadastro.tsx` (novo KPI + navegação), `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` (tradução do erro do guard).
- Sem migração de banco. Sem mudança no edge `aprovar-proposta` (guard já está ativo).
- Sem componente UI novo: reuso de `Tabs`, `Badge`, `KPICard`, `FlagTravada` e da tabela existente.

