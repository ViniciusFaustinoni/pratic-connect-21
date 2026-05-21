## Problema

Cotação `LTC8G02` (COT-20260521-164618683-919) tem `status='rascunho'`, `tipo_entrada='inclusao'`. Ela pertence à aba **Outros Processos** (junto com troca/substituição/migração/inclusão), mas o contador "1 no total" / "Em Andamento 1" da aba "Em Andamento" também a inclui — gerando o banner "Você tem 1 cotação em andamento, mas os filtros ativos estão ocultando todas" sem que filtro nenhum esteja realmente escondendo. Resultado: a cotação fica fantasma — aparece no contador, mas nunca lista.

## Causa raiz

A query da lista (`fetchCotacoesCore` em `src/hooks/useCotacoes.ts`) exclui `tipo_entrada IN ('troca_titularidade','substituicao_placa','substituicao','inclusao_veiculo','inclusao','migracao')` na aba "Em Andamento" (e idem em "Finalizadas"). Já a RPC `cotacoes_funil_counts` que alimenta o badge **não aplica essa exclusão** — conta a cotação como Em Andamento.

Divergência entre contador (servidor) e lista (servidor) = badge fantasma. Acontece com qualquer cotação Em Andamento de tipo "Outros Processos".

## Correção

Manter o critério em **um único lugar canônico**: a RPC `cotacoes_funil_counts`.

### Migration

Atualizar a função `public.cotacoes_funil_counts`:

1. Adicionar coluna `tipo_entrada` ao `WITH base AS (...)`.
2. Criar predicado `is_outros_processo := tipo_entrada IN ('troca_titularidade','substituicao_placa','substituicao','inclusao_veiculo','inclusao','migracao')`.
3. Aplicar `AND NOT is_outros_processo` nos filtros de:
   - `em_andamento_total`
   - `finalizadas_total`
   - `rascunho`, `enviada`, `escolhendo_plano`, `enviando_documentos`, `em_analise`, `assinando_contrato`, `pagando_taxa`, `agendando_vistoria`, `concluido`, `perdida` (todos os contadores que alimentam as abas Em Andamento / Finalizadas).
4. Adicionar contador `outros_processos_total` (`COUNT(*) FILTER (WHERE is_outros_processo)`) para a aba Outros Processos não precisar mais varrer client-side.
5. Manter `total` inalterado (representa o universo bruto).

### Frontend (opcional, escopo mínimo)

Nenhuma mudança obrigatória — a lista já filtra corretamente. Atualizar apenas o tipo `CotacoesFunilCounts` em `src/hooks/useCotacoes.ts` adicionando `outros_processos_total: number` (sem quebrar leitura existente, com `?? 0`). Não trocar a contagem do badge da aba "Outros Processos" agora para não expandir escopo — segue usando `outrosProcessosList?.length`.

## Fora do escopo

- Nenhum redesign de filtros, abas ou listagem.
- Nenhuma alteração na lógica de "qual cotação é Outros Processos" — lista canônica permanece a mesma definida em `src/pages/vendas/Cotacoes.tsx:214`.
- Nenhuma migração de dados — apenas a função do contador.

## Validação

1. RPC `cotacoes_funil_counts(p_search => 'LTC8G02')` → `em_andamento_total = 0`, `outros_processos_total = 1`.
2. UI: filtrar por LTC8G02 → aba "Em Andamento" mostra 0 (sem banner fantasma), aba "Outros Processos" mostra a cotação.
3. Sem filtro: contadores totais batem com a soma `em_andamento_total + finalizadas_total + outros_processos_total + (rascunho órfão sem status_contratacao)` esperada.
