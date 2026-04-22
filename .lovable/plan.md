

## Cotações somem para o Consultor após criar — correções

A causa raiz são problemas **combinados** na página `/vendas/cotacoes` quando acessada por **Consultor (vendedor_clt / vendedor_externo) em mobile**:

1. **O badge das abas `Em Andamento` e `Finalizadas` é calculado depois dos filtros** (`cotacoesEmAndamento.length` vem de `sortedCotacoes` → `filteredCotacoes`). Com qualquer filtro ativo (no print: `Status = Visualizada`), ambas as abas mostram `0` e o consultor pensa que a cotação **sumiu** — quando na verdade ela está oculta pelo filtro.
2. **O filtro de Status fica "preso"** — não há indicação visual forte de que ele está aplicado. O botão `Limpar 1` é discreto e o consultor não associa o filtro ao "sumiço" da cotação que acabou de criar (que entra como `rascunho`, não `visualizada`).
3. **Cotação recém-criada vai para `status = rascunho`**, mas o consultor está filtrando por outro status → invisível.
4. **No mobile**, a `statusBar` de pills (Rascunho / Link Enviado / Em Análise…) faz scroll horizontal e fica fora da tela; o consultor não vê o contador "Rascunho: 1" que indicaria que a cotação foi salva.
5. **RLS está correta** (`vendedor_id = auth.uid()` cobre vendedor_clt e vendedor_externo) e o `useCreateCotacao` seta `vendedor_id` corretamente — não há perda de dados, é só visualização.

### O que vai mudar

**1. Contadores das abas independentes dos filtros** (arquivo `src/pages/vendas/Cotacoes.tsx`)
- Criar `cotacoesEmAndamentoTotal` e `cotacoesFinalizadasTotal` calculados sobre `cotacoes` (lista bruta), aplicando **só** a separação por status — sem aplicar `statusFilter`, `mesFilter`, `dataFilter`, `etapaFunilFilter`, `consultorFilter`, `filtroOrfas` e `search`.
- Usar esses totais nos badges das `TabsTrigger`. Assim o consultor sempre enxerga "Em Andamento: 1" mesmo se o filtro estiver escondendo.
- Manter o `cotacoesEmAndamento`/`cotacoesFinalizadas` filtrado para a renderização da `CotacoesTable`.

**2. Banner de "filtros ativos escondendo resultados"** (mesmo arquivo)
- Quando `cotacoes.length > 0`, `(cotacoesEmAndamento.length === 0 && activeTab === 'em_andamento')` e `hasActiveFilters === true`, exibir banner âmbar acima da tabela:
  - Texto: *"Você tem N cotação(ões), mas os filtros ativos estão ocultando todas. [Limpar filtros]"*
  - Botão `Limpar filtros` que chama `clearFilters()`.
- Mesma lógica para a aba `Finalizadas`.

**3. Default de `statusFilter` mais robusto**
- Garantir que `statusFilter` inicia em `'all'` (já está), e adicionar **reset automático** quando o usuário troca de aba: ao entrar em `em_andamento` resetar `statusFilter='all'` se estava em valor não-pertencente à aba anterior. Evita filtro "fantasma" carregado entre navegações.

**4. Após criar cotação, sempre voltar para a aba e estado correto**
- No `onSuccess` do `CotacaoFormDialog` (já chamado dentro da página), forçar `setActiveTab('em_andamento')`, `setStatusFilter('all')`, `setEtapaFunilFilter('all')`, `setDataFilter(undefined)`, `setMesFilter('all')`, `setSearchInput('')` — para que a cotação recém-criada (status `rascunho`) apareça imediatamente.
- Adicionar toast de sucesso com link "Ver cotação" que abre o modal de detalhes da cotação criada.

**5. Indicador visual de "Cotações que você criou" no mobile**
- Acima da `TabsList`, em mobile apenas (`md:hidden`), exibir card compacto:
  - "Você tem **X** cotação(ões) ativa(s)" — sempre baseado em `cotacoes.length` (sem filtros), com cor `primary`.
- Garante que o consultor sempre veja que existem cotações, mesmo se filtros escondem a tabela.

### Impacto

- Vale para **todos** os perfis (Diretor, Consultor, Analista) — Diretor já enxergava porque tem mais largura de tela e raramente usa filtros sticky; consultor em mobile passa a ter a mesma clareza.
- Sem mudanças de schema, RLS ou Edge Functions.
- Sem alteração no fluxo de criação ou no `vendedor_id`.

### Arquivos editados

- `src/pages/vendas/Cotacoes.tsx` — contadores totais, banner de filtros, reset pós-criação, card mobile.

