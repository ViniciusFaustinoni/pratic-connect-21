

## Consolidar Serviços de Campo em uma única tela unificada

### Diagnóstico
Hoje `Serviços de Campo` tem 8 abas (`Atribuição Manual`, `Instalações`, `Vistorias`, `Retiradas`, `Encaixes`, `Viagens`, `Manutenção`, `Histórico`) — cada uma é uma página separada com sua própria lista, métricas e filtros, mesmo a maioria dos dados vindo da **mesma tabela `servicos`** (já tem `tipo`, `status`, `data_agendada`, etc.).

A duplicação dificulta:
- visão geral (analista precisa pular abas)
- filtros cruzados (ex.: "tudo de hoje em SP")
- comparação de SLA entre tipos

### Solução: aba única "Serviços" + abas operacionais reduzidas

**1. Nova aba "Serviços" (default)** — tabela única com todos os tipos de serviço de campo, diferenciados por **Badge de tipo** com tooltip rico, e **modal de detalhes ao clicar na linha**.

```text
ABAS NOVAS (Serviços de Campo)
├─ Serviços (NOVA — default, lista unificada)
├─ Atribuição Manual (mantém — operacional drag&drop)
├─ Encaixes (mantém — operacional)
├─ Viagens (mantém — específico de logística + diárias)
├─ Manutenção (mantém — fluxo próprio)
└─ Histórico (mantém)

REMOVIDAS (consolidadas na aba Serviços)
├─ Instalações
├─ Vistorias
└─ Retiradas
```

Os fluxos operacionais (Atribuição Manual, Encaixes, Viagens, Manutenção, Histórico) ficam separados porque têm UX próprio. A consolidação atinge as 3 listagens equivalentes.

### Componentes da nova aba "Serviços"

**A. Métricas no topo (8 cards clicáveis filtram)**
- Pré-execução (agendada + atribuida + aguardando_prestador + pendente)
- Em campo (em_rota + no_local + em_andamento)
- Aguardando análise (em_analise)
- Concluídas hoje
- Não compareceu
- Reagendadas
- Multas/bloqueios (badge específico de retiradas)
- Total do dia

**B. Filtros**
- Busca: nome / placa / protocolo / código rastreador
- Tipo (multi-select com 8 opções, todas marcadas por padrão): Instalação, Revistoria, Vist. Entrada, Vist. Saída, Vist. Sinistro, Vist. Periódica, Vist. Manutenção, Retirada
- Status (multi-select agrupado por fase)
- Origem técnico (Interno / Prestador externo)
- Cidade/UF
- Data (range)
- Botão "Limpar"

**C. Tabela unificada — colunas**
| Tipo | Data/Período | Associado | Veículo | Endereço | Técnico | Status | Ações |

- **Coluna Tipo**: `Badge` colorido com ícone (Wrench / ClipboardCheck / PackageX / RefreshCw…) usando o mapa `TIPO_SERVICO_COLORS` já existente.
- **Tooltip no Badge** (Radix `Tooltip`): mostra
  - Nome completo do tipo (ex.: "Vistoria de Sinistro")
  - Protocolo
  - Origem (cadastro / monitoramento / financeiro / sinistro)
  - Motivo (quando retirada/sinistro)
  - SLA / data limite quando aplicável
  - Flag "Encaixe permitido" / "Cliente aceita encaixe"
- **Linha clicável** → abre **Modal de Detalhes**

**D. Modal de Detalhes (`ServicoDetailModal`)**
Componente novo que rotea para o conteúdo certo conforme `tipo`:
- `instalacao` / `revistoria` → reusa `InstalacaoDetailDrawer`
- `vistoria_*` (exceto retirada) → reusa `VistoriaDetailDrawer`
- `vistoria_retirada` → conteúdo dedicado (motivo, multa, integridade, deadline) — reaproveita os componentes já presentes em `RetiradasContent`

Header do modal:
- Badge de tipo + Badge de status
- Protocolo, data/período
- Quick actions: WhatsApp, Maps, "Ver no mapa de monitoramento"
- Tabs internas: **Resumo** | **Cliente & Veículo** | **Endereço** | **Histórico** | **Mídias** (quando houver) | **Ações operacionais** (cancelar, reagendar, atribuir prestador)

### Arquivos previstos

**Novos**
- `src/pages/monitoramento/ServicosCampoUnificado.tsx` — página da aba "Serviços"
- `src/components/servicos-campo/ServicosTable.tsx` — tabela unificada com tooltip
- `src/components/servicos-campo/ServicoTipoBadge.tsx` — Badge + Tooltip rico
- `src/components/servicos-campo/ServicosFilters.tsx` — filtros consolidados
- `src/components/servicos-campo/ServicoDetailModal.tsx` — modal roteador
- `src/components/servicos-campo/ServicosMetricasCards.tsx` — 8 cards clicáveis
- `src/hooks/useServicosCampoUnificado.ts` — hook que envelopa `useServicos` aplicando todos os filtros e devolvendo métricas agrupadas

**Editados**
- `src/pages/monitoramento/VistoriasInstalacoesMon.tsx` — substituir as 3 abas (`Instalações`, `Vistorias`, `Retiradas`) por uma só aba `Serviços` (default), reordenar restantes
- (Não vamos apagar ainda `Instalacoes.tsx` / `Vistorias.tsx` / `RetiradasContent.tsx` — eles continuam sendo usados em rotas/modais internos; só removemos as abas. Limpeza definitiva pode vir num passo seguinte se você quiser.)

### Reaproveitamento
- `useServicos({ tipo: [...] })` já existe e suporta filtro multi-tipo
- `STATUS_SERVICO_LABELS`, `STATUS_SERVICO_COLORS`, `TIPO_SERVICO_LABELS` já existem em `src/hooks/useServicos.ts`
- `InstalacaoDetailDrawer` e `VistoriaDetailDrawer` já existem e serão reutilizados pelo modal roteador
- Tooltip do shadcn já está disponível (`@/components/ui/tooltip`)

### Validação
1. Abrir `/monitoramento/vistorias-instalacoes-mon` → aba "Serviços" abre por padrão com lista de tudo.
2. Cards de métricas mostram contagens corretas; clicar em "Em Campo" filtra a tabela.
3. Cada linha mostra Badge de tipo colorido. Hover no Badge → tooltip com protocolo, origem, motivo, SLA.
4. Clicar em linha de instalação → modal abre conteúdo de `InstalacaoDetailDrawer`.
5. Clicar em linha de vistoria de saída → modal abre conteúdo de `VistoriaDetailDrawer`.
6. Clicar em linha de retirada → modal abre conteúdo dedicado (multa, integridade, deadline).
7. Filtro multi-tipo funciona (ex.: marcar só "Retirada + Vist. Sinistro").
8. Filtro de status agrupado por fase funciona.
9. Filtro de origem (Interno/Prestador) funciona.
10. Busca por placa, nome, protocolo, código rastreador funciona em todos os tipos.
11. Atribuição Manual, Encaixes, Viagens, Manutenção e Histórico continuam funcionando como hoje (sem regressão).

