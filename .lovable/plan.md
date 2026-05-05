## Diagnóstico do giro 360°

Login realizado como diretor; testei `/cadastro/associados` e `/vendas/cotacoes` e mapei o resto por código (106 telas têm campo de busca).

### Achados macro

| Categoria | Contagem | Observação |
|---|---|---|
| Telas com tabela/grid + dados | ~120 | base do giro |
| Já têm paginação server-side | 12 | Associados, Veículos, Leads, Propostas, Cotações, Inadimplentes, Cobranças, Comissões/Pagamentos, Conta Corrente, Chamados, Agência |
| Sem paginação, com `.limit(50‑1000)` fixo | ~25 | listas truncam silenciosamente após o teto |
| Sem paginação E sem limit (carregam tudo) | ~40 | pesado em telas como `RH/Funcionarios`, `Juridico/Casos`, `Eventos/Sindicancias`, `Configuracoes/Perfis`, `Diretoria/TabelaPrecos`, `Cobrança/RelacionamentoTrocas`, `Marketing/ComunicacaoMassa` |
| Filtro só client-side (`.filter().toLowerCase().includes()`) | espalhado | não acha registros que estão depois do limit |
| Sem `useDebounce` na busca | maioria | dispara request a cada tecla |

### Bugs concretos observados em runtime

1. **`/vendas/cotacoes`**: header diz "295 Em Andamento" mas a tabela renderiza vazia "Nenhuma cotação encontrada" sem qualquer filtro aplicado. Filtro/paginação está dessincronizado dos counts.
2. **`/cadastro/associados`**: busca funciona, mas só busca os já carregados (não dispara nova query no servidor — confirmar se `useAssociadoSearch` cobre).
3. Counts dos cards de KPI batem 9.534 mas a tabela tem `.limit` interno que não é exposto na UI (sem indicador "mostrando X de Y").

## Estratégia: padrão único de listagem paginada

Em vez de retocar 100+ telas, criar **3 primitivas reusáveis** e migrar telas em ordem de impacto:

### 1. Hook `useServerList<T>` — `src/hooks/useServerList.ts`

Wrapper sobre `@tanstack/react-query` que padroniza:

- Estado: `{ search, page, pageSize, sort, filters }` em URL (`useSearchParams`) — link compartilhável e back-button funciona.
- Debounce automático de `search` (300 ms via `useDebounce` já existente).
- Query factory recebe `(supabase, { search, page, pageSize, filters })` e devolve `{ data, count }` usando `.range((page-1)*size, page*size-1)` + `count: 'exact'`.
- Retorna `{ items, total, totalPages, page, setPage, search, setSearch, filters, setFilters, isLoading, isFetching }`.

### 2. Componente `<ListToolbar />` — `src/components/lists/ListToolbar.tsx`

Barra padrão: input de busca (com X para limpar), slots para selects de filtro, botão "Limpar filtros", contagem "Mostrando A–B de N".

### 3. Componente `<ServerPagination />` — `src/components/lists/ServerPagination.tsx`

Reusa `src/components/ui/pagination.tsx`. Mostra Anterior/Próxima, números (com ellipsis), seletor de tamanho de página (25/50/100), e botão "Ir para página".

### 4. Migração das telas — em ondas

**Onda 1 — bugs críticos visíveis (essa entrega):**

- `/vendas/cotacoes` — corrigir o desalinhamento entre counts e tabela (provavelmente a query da tabela aplica filtros que o counter não aplica; checar `useCotacoesPaginadas` vs `useCotacoesFunilCounts`).
- `/cadastro/associados` — confirmar que a busca dispara server-side e mostrar "X de Y".

**Onda 2 — telas que truncam silenciosamente (`.limit` fixo sem paginação):**

`PosVenda`, `Logs` (configurações), `Negativacao`, `SinistrosList`, `SolicitacoesIA`, `FilaTrabalho`, `EventosPreAnalise`, `ContasPagar`, `AlertasMonitoramento`, `Extrato`, `ProcessosList` (jurídico), `ReguladorOficina`, `LogsAuditoria`, `EventosChatIA`. Adotam `useServerList` + `<ServerPagination />`. Default 50/pg.

**Onda 3 — telas grandes sem nenhum limite:**

`rh/FuncionariosList`, `rh/ControlePonto`, `rh/FolhaPagamento`, `juridico/CasosJuridicosList`, `juridico/PrazosControl`, `eventos/SindicanciasList`, `configuracoes/Perfis`, `configuracoes/PlanosSGA`, `diretoria/TabelaPrecos`, `diretoria/IndicadoresAtuariais`, `diretoria/PerfisAcesso`, `cobranca/RelacionamentoTrocas`, `marketing/ComunicacaoMassa`, `monitoramento/FilaVistorias`, `monitoramento/RetiradasPage`, `assistencia/PrestadoresList`, `oficinas/AutoCenters`, `oficinas/Oficinas`. Idem.

**Onda 4 — buscas client-only que precisam ir pro servidor:**

Onde hoje é `array.filter(toLowerCase().includes())` aplicar a busca via `.or('campo1.ilike.%x%,campo2.ilike.%x%')` na query.

### 5. Padrão de busca server-side

Toda lista usa `.or(...)` com `ilike` nos campos textuais relevantes (nome/placa/CPF/numero/telefone/email/ID). CPF/telefone normalizados (remover máscara antes de comparar). Em colunas indexadas pesadas, considerar trigram (`pg_trgm`) — fora desta entrega, registrar TODO.

## Critérios de aceitação por tela migrada

- Total visível "Mostrando 1–50 de 9.534".
- Busca dispara após 300 ms, atualiza URL (`?q=marcos&page=1`).
- Paginação navega sem reload e preserva filtros.
- Filtros mostram chip "Limpar" quando ativos.
- F5 / compartilhar URL restaura o estado completo.

## Detalhes técnicos

- `useServerList` aceita `queryKey` array para invalidação seletiva e `enabled` opcional.
- `count: 'exact'` em todas as queries paginadas (custo aceitável para listas filtradas).
- Para telas com counts/KPIs separados (ex.: Cotações tem cards por status), manter hook dedicado de counts mas garantir mesma cláusula `where` que a tabela quando os filtros se aplicam.
- Mobile: paginação vira "Carregar mais" via prop `mode="loadMore"` no mesmo hook.

## Fora de escopo

- Reescrever as telas de detalhes (não-listas).
- Indexação trigram / full-text — apenas registrar como melhoria futura.
- Telas de dashboard (Diretoria/Indicadores etc.) sem natureza de "lista pesquisável".

## Entregáveis desta primeira execução

1. Criar `useServerList`, `ListToolbar`, `ServerPagination`.
2. Aplicar onda 1 (corrigir bug Cotações + ajustar Associados).
3. Aplicar onda 2 (telas com `.limit` fixo) — ~14 telas.
4. Após validação, abrir nova entrega para ondas 3 e 4.
