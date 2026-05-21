## Objetivo

Mostrar cotações de **Inclusão**, **Troca de titularidade**, **Substituição** e **Migração** também na aba principal **"Em Andamento" / "Finalizadas"** — sem removê-las da aba "Outros Processos". Cada linha leva um **badge de tipo** (Inclusão / Troca / Substituição / Migração) no mesmo padrão visual usado hoje na fila do Cadastro, para o corretor identificar sem precisar abrir.

Caso de teste: LTC8G02 (COT-20260521-…-919, `tipo_entrada='inclusao'`) deve aparecer em Em Andamento com badge "Inclusão de veículo" e continuar visível em Outros Processos.

## Diagnóstico

- `src/pages/vendas/Cotacoes.tsx` passa `excluirTiposEntrada: ['troca_titularidade','substituicao_placa','substituicao','inclusao_veiculo','inclusao','migracao']` para `useCotacoes` → esses tipos somem da aba principal.
- `useCotacoes.ts` aplica o filtro como `tipo_entrada.is.null,tipo_entrada.not.in.(...)`.
- RPC `cotacoes_funil_counts` calcula `em_andamento_total`, `finalizadas_total` e cada status com `WHERE NOT is_outros` → badges não batem com a listagem nova.
- `useOutrosProcessos.ts` filtra só pelos canônicos (`'inclusao_veiculo'`, `'substituicao_placa'`, …) — alias `'inclusao'` / `'substituicao'` ficam fora da aba Outros Processos.
- Badge: o componente `TipoEntradaBadge` (usado na fila do Cadastro em `PropostasPendentes`) já cobre os 4 tipos com cores/ícones. Reaproveitar é o caminho certo, sem CSS novo.

## Correção

### 1. Aba principal volta a listar todos os tipos
`src/pages/vendas/Cotacoes.tsx` (linha ~214): remover `excluirTiposEntrada` da chamada do `useCotacoes` (ou passar `[]`). Em Andamento e Finalizadas passam a mostrar LTC8G02 e demais inclusões/trocas/substituições/migrações.

### 2. RPC `cotacoes_funil_counts` alinhada (migração)
Reescrever a função removendo `WHERE NOT is_outros` de **todos** os contadores principais (`em_andamento_total`, `finalizadas_total`, `rascunho`, `enviada`, `escolhendo_plano`, `enviando_documentos`, `em_analise`, `assinando_contrato`, `pagando_taxa`, `agendando_vistoria`, `concluido`, `perdida`). Manter `outros_processos_total` calculado com `is_outros` — o badge da aba Outros Processos continua igual. Assim o banner "filtros estão escondendo resultados" para de aparecer indevidamente.

### 3. Badge de tipo na tabela de cotações
`src/pages/vendas/Cotacoes.tsx`: na linha de cada cotação, renderizar `<TipoEntradaBadge tipo={c.tipo_entrada} />` ao lado do código/placa (mesmo componente já usado em `PropostasPendentes`). Para cotações comuns (`tipo_entrada` nulo) o componente retorna `null` e nada muda. `tipo_entrada` já vem do `select` em `useCotacoes` — não precisa novo fetch.

### 4. "Outros Processos" aceita aliases
`src/hooks/useOutrosProcessos.ts`:
- Expandir `.in('tipo_entrada', …)` para incluir `'inclusao'` e `'substituicao'` quando o conjunto contiver os canônicos correspondentes.
- No mapeamento da linha (~270): normalizar `'inclusao'→'inclusao_veiculo'` e `'substituicao'→'substituicao_placa'` antes de tipar como `TipoOutroProcesso`. API pública do hook não muda.

## Validação

1. `psql`: rodar `cotacoes_funil_counts` para o vendedor dono de LTC8G02 → `em_andamento_total ≥ 1` **e** `outros_processos_total ≥ 1` (mesma cotação contada nas duas agregações).
2. UI `/vendas/cotacoes` como esse corretor:
   - Em Andamento: LTC8G02 aparece com badge "Inclusão de veículo", sem banner de filtro.
   - Outros Processos: LTC8G02 segue lá, mesmo badge.
3. Regressão: cotação comum (`tipo_entrada` nulo) aparece só em Em Andamento, sem badge. Troca de titularidade aparece nas duas abas com badge correto. Nenhum tipo duplicado dentro da mesma aba.

## Fora do escopo

- Não migrar `'inclusao'` → `'inclusao_veiculo'` no banco (alias segue válido — `mem://constraints/contracts/tipo-entrada-substituicao-canonical`).
- Sem alterações em `Cotador.tsx`, `CotacaoContratacao.tsx`, edge functions, cadastro ou monitoramento.
- Aba "Outros Processos" continua existindo como atalho/visão dedicada.
