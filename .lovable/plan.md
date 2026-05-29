# Limpar página Cotacao.tsx morta e a pasta `components/cotacao/`

## Confirmação (varredura no código)

- `src/pages/vendas/Cotacao.tsx` não tem rota em `App.tsx` nem é importado por ninguém.
- `src/components/cotacao/` contém **15 arquivos**. Destes:
  - **4 vivos** (consumidos fora da pasta):
    - `DebitosCard.tsx` — `components/vendas/OutrasEntradasMenu.tsx`
    - `SgaTransientAlert.tsx` — `OutrasEntradasMenu.tsx` + `associados/TrocaTitularidadeDialog.tsx`
    - `IgnorarAvisoSGADialog.tsx` — `cotacoes/VeiculoSGAModal.tsx`, `PlacaOutroAssociadoModal.tsx`, `PlacaDuplicadaModal.tsx`
    - `DraftRestoreBanner.tsx` — `cotacoes/CotacaoFormDialog.tsx`
  - **11 órfãos** (só usados por `Cotacao.tsx` ou entre si): `CotacaoStepper`, `EtapaDadosAssociado`, `EtapaConsultaFipe`, `EtapaCriteriosCotacao`, `EtapaResultado`, `EtapaCategoriaVeiculo`, `EtapaDadosVeiculo`, `DialogTipoOperacao`, `AlertaElegibilidadeNegada`, `BlocoDepreciacaoCotacao`, `PlanoCardCotacao`.

## Mudanças

### 1. Mover os 4 componentes vivos para `src/components/cotacoes/`
A pasta canônica do domínio cotação plural já existe e abriga `CotacaoFormDialog`, `VeiculoSGAModal`, etc. Move tudo para lá (não criar `components/shared/`):
- `cotacao/DebitosCard.tsx`         → `cotacoes/DebitosCard.tsx`
- `cotacao/SgaTransientAlert.tsx`   → `cotacoes/SgaTransientAlert.tsx`
- `cotacao/IgnorarAvisoSGADialog.tsx` → `cotacoes/IgnorarAvisoSGADialog.tsx`
- `cotacao/DraftRestoreBanner.tsx`  → `cotacoes/DraftRestoreBanner.tsx`

### 2. Atualizar os 6 imports externos
Substituir `@/components/cotacao/` por `@/components/cotacoes/` em:
- `src/components/vendas/OutrasEntradasMenu.tsx` (2 imports: DebitosCard, SgaTransientAlert)
- `src/components/associados/TrocaTitularidadeDialog.tsx` (SgaTransientAlert)
- `src/components/cotacoes/VeiculoSGAModal.tsx` (IgnorarAvisoSGADialog)
- `src/components/cotacoes/PlacaOutroAssociadoModal.tsx` (IgnorarAvisoSGADialog)
- `src/components/cotacoes/PlacaDuplicadaModal.tsx` (IgnorarAvisoSGADialog)
- `src/components/cotacoes/CotacaoFormDialog.tsx` (DraftRestoreBanner)

### 3. Deletar arquivos mortos
- `src/pages/vendas/Cotacao.tsx`
- Os 11 componentes órfãos listados acima.
- A pasta `src/components/cotacao/` toda (ficará vazia após os passos 1 e 3).

### 4. Verificação
- `rg "components/cotacao/"` deve voltar vazio.
- `rg "pages/vendas/Cotacao"` deve voltar vazio.
- Build TS deve passar.

## Fora de escopo
- Mudanças visuais ou de comportamento nos componentes movidos.
- Renomear `components/cotacoes/` → outra nomenclatura.
- Mexer em `Cotador.tsx` (a página viva).
