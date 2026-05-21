## Objetivo

Padronizar **todas as abas** de `Processos Operacionais` (`/cadastro/processos`) no mesmo formato de **card** usado hoje em **Titularidade** — incluindo **status badge**, **consultor**, **associado** e **detalhes do veículo** — eliminando as tabelas atuais de Substituições, Migrações e Inclusões.

A estrutura de navegação (4 abas principais + sub-abas por status) **continua igual**. O que muda é só o **conteúdo de cada aba**: tudo vira card no padrão Troca.

---

## ⚠️ Garantia de não-regressão funcional

Esta refatoração é **puramente cosmética/de apresentação**. Nada do que está abaixo pode ser tocado:

| Camada | Status nesta entrega |
|---|---|
| Banco de dados (tabelas, colunas, índices) | **Intocado** |
| Triggers, functions, RPCs | **Intocado** |
| Edge functions (efetivar-troca-titularidade, efetivar-substituicao, criar-instalacao-pos-pagamento, vincular-cotacao-troca, ativar-associado, sga-hinova-sync, etc.) | **Intocadas** |
| RLS / políticas de acesso | **Intocadas** |
| Hooks de mutação (aprovar, reprovar, efetivar, cancelar, dispensar vistoria, solicitar manutenção) | **Intocados** |
| Modais de detalhe (`ModalDetalhesTroca`, rota `/cadastro/substituicoes/:id`, modal Migração, ficha do associado) | **Intocados** — só são abertos pelo botão Detalhes do novo card |
| Filtros canônicos de status (`TROCA_FILTROS`, `SUB_TAB_FILTERS`, filtros de Migração e Inclusão) | **Intocados** |
| Regras de permissão (`canSeeAll`, `scopeProfileId`, `scopeAuthUserId`, `modoUsuario` cadastro/monitoramento/readonly/auto, banner read-only do Cadastro) | **Intocadas** |
| Queries de contagem (`useProcessosCounts`) e KPIs do topo | **Intocadas** |
| Hooks de leitura existentes (`useSolicitacoesTroca`, `useSubstituicoes`, queries de Inclusão e Migração) | **Intocados** — apenas envolvidos por um join opcional de `profiles` para exibir o nome do consultor |
| Deep-link `?tab=` e URL state | **Intocado** |
| Fluxo público (link público, autovistoria, agendamento, contratação, assinatura, pagamento) | **Não tocado** — esta página é interna |
| SGA Hinova, Autentique, ASAAS, Softruck, Rede Veículos | **Não tocado** |
| Notificações / WhatsApp / templates Meta | **Não tocado** |
| Auditoria (`associados_historico`, `sga_sync_queue`, logs) | **Não tocado** |

Regras canônicas que continuam valendo sem qualquer alteração:
- Troca de titularidade — etapas bloqueantes (transferência, contrato novo, cancelamento do anterior), janela mesmo-dia, religar cobertura, cancelar titular órfão, banner read-only do Cadastro
- Substituição — gate de débito, vistoria, FIPE alta, herança de carência
- Inclusão — CNH/CPF auto-detect, anti-sequestro pelo nome, badge "INCLUSÃO DE VEÍCULO"
- Migração — fluxo do consultor externo
- Cadastro → Monitoramento — todos os guards DB (`trg_protege_cadastro_aprovado`, `trg_guard_*`) e o caminho `ativar-associado`

### Como a garantia é verificada

1. **Diff cirúrgico**: cada PR/edit toca exclusivamente arquivos de UI (`src/pages/cadastro/ProcessosOperacionais.tsx`, `src/pages/cadastro/SolicitacoesMigracao.tsx` no bloco de render, e novos arquivos em `src/components/processos/`). Nenhuma `supabase.from('…').update/insert/delete`, nenhuma RPC, nenhuma edge function.
2. **Sem migration**: não há `supabase--migration` nesta entrega.
3. **Mesmas queries de leitura**: continuamos consumindo `useSolicitacoesTroca`, `useSubstituicoes`, a query atual de Inclusões e `MigracoesTab`. O único acréscimo é um SELECT em `profiles` (via `in('user_id', […])`) para resolver nome/avatar do consultor — leitura pura, sem efeito colateral.
4. **Mesmos pontos de entrada de ação**: o botão "Detalhes" abre exatamente o mesmo modal/rota de hoje, mantendo `modoModal` resolvido pela mesma lógica atual.
5. **Smoke test manual ao final**: abrir cada aba, conferir que (a) os contadores batem, (b) o filtro canônico de status devolve os mesmos itens, (c) o botão Detalhes leva ao mesmo destino, (d) ações dentro do modal seguem disponíveis para os mesmos perfis.

---

## Diagnóstico

| Aba | Render atual | Tem consultor? | Tem associado nominal? | Status como badge? |
|---|---|---|---|---|
| Titularidade | Card (padrão alvo) | ❌ falta | ✔ | ✔ |
| Substituições | Tabela densa | ❌ | ✔ (coluna) | ✔ (coluna) |
| Migrações | Tabela externa (`MigracoesTab`) | ❌ | parcial | ✔ |
| Inclusões | Tabela densa | ❌ | ❌ (só ID) | ✔ (coluna) |

Padrão visual do card de Troca (referência):

```text
[STATUS BADGE] [BADGES extra: Termo OK / Erro SGA / Vistoria...]
NOME ASSOCIADO  →  CONTRAPARTE (quando aplicável)
🚗 Marca Modelo Ano · Placa XXXNNNN
👤 Consultor: Nome  ·  Criada em DD/MM/AAAA HH:mm
                                                  [ Detalhes ]
```

---

## Escopo do plano

### 1. Componente único `ProcessoCard`

Novo `src/components/processos/ProcessoCard.tsx` que recebe uma forma normalizada:

```ts
type ProcessoCardData = {
  id: string;
  statusBadge: { label: string; tone: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' };
  badgesExtra?: { icon?: LucideIcon; label: string; tone: 'success' | 'info' | 'warn' | 'danger' }[];
  associado: { nome: string; cpf?: string };
  contraparte?: { nome: string };               // só Troca
  veiculo: { marca?; modelo?; ano?; placa? };
  consultor?: { nome: string; avatarUrl?: string };
  criadoEm: string;
  detalhes: { tipo: 'modal' | 'rota' | 'externo'; onClick: () => void };
  acoesExtras?: { icon: LucideIcon; title: string; onClick: () => void }[];
};
```

Visual idêntico ao card de Titularidade hoje (linhas 137–227 de `ProcessosOperacionais.tsx`), só que com uma linha a mais para `👤 Consultor`.

### 2. Adaptadores por tipo (apenas leitura/transformação)

**Titularidade** — adiciona consultor (`profiles` por `criado_por`); mantém badges atuais (Termo assinado, Autovistoria concluída, Vistoria base agendada, Vistoria dispensada, Erro SGA, etc.).

**Substituições** — tabela vira lista de cards; `statusBadge` reaproveita `STATUS_SUBSTITUICAO_LABELS`/`CORES`; `badgesExtra` para `FIPE ALTA`; mantém busca e sub-abas; Detalhes navega para a rota atual.

**Migrações** — `MigracoesTab` adota o `ProcessoCard` no lugar da tabela interna; consultor via `consultor_id`; status como hoje; destino atual mantido.

**Inclusões** — passa a exibir associado por nome (já há batch parecido no arquivo) e consultor (`vendedor_id`); promove `Aviso SGA ignorado` / `Observação SGA` de tooltip para `badgesExtra`; ações `Abrir link público` (quando `token_publico`) e `Ver associado` continuam.

### 3. Estrutura de página inalterada

Header, descrição, alerta de escopo, 4 KPIs, top tabs, sub-tabs, busca local, refetch, URL `?tab=` — tudo igual.

### 4. Layout esperado por aba

```text
ABA SUBSTITUIÇÕES
  [ Pendentes ] [ Aprovadas ] [ Rejeitadas ] [ Efetivadas ] [ Todas ]
  [🔍 Buscar associado ou placa]                 [⟳]
  ┌────────────────────────────────────────────────────────┐
  │ [Aguard. aprovação] [FIPE ALTA]                        │
  │ NOME DO ASSOCIADO                                      │
  │ 🚗 Veículo antigo → Veículo novo · Placas              │
  │ 💰 R$ 220,00 → R$ 248,90                               │
  │ 👤 Consultor: Ana · Solicitada em 18/05/2026           │
  │                                          [ Detalhes ]  │
  └────────────────────────────────────────────────────────┘

ABA INCLUSÕES
  [ Em cotação ] [ Enviadas ] [ Em contratação ] [ Contratadas ] [ Todas ]
  [🔍 Buscar associado, placa, nº]                [⟳]
  ┌────────────────────────────────────────────────────────┐
  │ [Em cotação] [Observação SGA]                          │
  │ MARCOS ANTONIO GUIMARÃES · CPF 006.920.227-32          │
  │ 🚗 Fiat Siena Attractive 2018 · Placa LTC8G02          │
  │ 💰 FIPE R$ 44.921 · Mensalidade R$ 225,70              │
  │ 👤 Consultor: João P. · Criada em 21/05/2026           │
  │                                 [Abrir link] [Detalhes]│
  └────────────────────────────────────────────────────────┘
```

### 5. Fora de escopo

- Sem mudança de regras de negócio (filtros canônicos de status, RLS, permissões `canSeeAll`, banner read-only do Cadastro: tudo igual).
- Sem mudança de banco, edge function ou modal de detalhe.
- Sem unificar as 4 abas em uma lista única — o pedido é uniformidade **visual**.

---

## Arquivos previstos

- `src/components/processos/ProcessoCard.tsx` (novo)
- `src/components/processos/StatusBadge.tsx` (novo, opcional — pode ficar dentro do card)
- `src/pages/cadastro/ProcessosOperacionais.tsx` — substitui as tabelas de Substituições e Inclusões por listas de `ProcessoCard`; adiciona join de consultor em Titularidade
- `src/pages/cadastro/SolicitacoesMigracao.tsx` — `MigracoesTab` adota o `ProcessoCard` para a lista interna

Nenhum arquivo de hook de mutação, edge function, migration ou tipo do Supabase será tocado.

---

## Resultado esperado

- Mesma experiência visual nas 4 abas, próxima ao card de Troca atual
- Consultor visível em todos os tipos
- Associado sempre nominal (resolve queixa específica de Inclusões)
- Status e flags relevantes (FIPE alta, Observação SGA, Termo assinado, etc.) virando badges no topo do card em vez de células de tabela escondidas
- **Zero impacto** nos fluxos operacionais ligados à página
