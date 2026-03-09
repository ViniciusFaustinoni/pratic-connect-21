

# Plano: Eliminar todo hardcode de Planos e Benefícios — migrar para fontes dinâmicas

## Resumo

Existem **8 focos de hardcode** restantes. As fontes dinâmicas já existem no banco (`beneficios_adicionais`, `regioes`, `main_coverages`, `benefits`, `tabelas_preco`, `configuracoes`). O trabalho é substituir os imports estáticos pelas queries dinâmicas e criar chaves em `configuracoes` para dados que ainda não têm tabela.

---

## Alterações por foco

### Foco 1 — `StepBeneficios.tsx` e `StepFinanceiro.tsx`: benefícios e preços hardcoded

**Problema:** `BENEFICIOS[]`, `BENEFICIOS_PRECOS{}`, `FAIXAS_TERCEIROS` duplicados com preços fixos (R$9.90, R$2.90 etc.) + taxa `0.0045` fixa.

**Solução:**
- Criar hook `useBeneficiosAdicionaisCotacao()` que busca de `beneficios_adicionais` (tabela já tem 14 registros com preços corretos)
- Substituir arrays estáticos nos dois componentes pelo hook
- Substituir `fipe * 0.0045` por lookup na `tabelas_preco` (campo `taxa_comercial`) — criar hook `useTaxaMensalidade(valorFipe)` que busca a faixa aplicável
- Mover `TAXA_SUBSTITUICAO = 50.00` para chave `taxa_substituicao` na tabela `configuracoes`
- Substituir `veiculoAntigo.valor_fipe * 0.06` (cota fallback) por lookup dinâmico via `useFaixasCotas` (já existe)

### Foco 2 — `usePlanosCotacao.ts`: região e fallbacks hardcoded

**Problema:** `mapearRegiao()` com mapa fixo, `calcularPrecoRegiao()` com multiplicador `0.90` fixo, fallbacks `0.025`/`0.03`, decomposição `0.60/0.25/0.10/0.05`, ordenação fixa por código `['select-basic', ...]`.

**Solução:**
- Buscar `regioes` do banco (já tem `multiplicador_preco`: RJ=1.00, Lagos=0.90, SP=1.15) — criar hook `useRegioes()` e usar `multiplicador_preco` da região selecionada
- Remover `mapearRegiao()` e `calcularPrecoRegiao()` de `planosPrecos.ts` — usar `regioes.codigo` diretamente
- Mover fallbacks `0.025`/`0.03` para chaves `taxa_fallback_carro` e `taxa_fallback_moto` em `configuracoes`
- Mover percentuais de decomposição (`0.60`, `0.25`, `0.10`, `0.05`) para chaves em `configuracoes`
- Substituir ordenação fixa por `planos.ordem` do banco (já existe campo `ordem`)

### Foco 3 — `useCalcularCotacao.ts`: fallback hardcoded

**Problema:** `valorFipe * 0.025 / 12` como fallback.

**Solução:** Reutilizar mesma chave `taxa_fallback_carro` de `configuracoes` criada no Foco 2.

### Foco 4 — `Cotacoes.tsx`: categorização de coberturas hardcoded

**Problema:** `CATEGORIAS_BENEFICIOS` com 35 termos fixos mapeando coberturas a categorias.

**Solução:** A tabela `benefits` já tem coluna `category` preenchida (`cobertura`, `assistencia`, `extra`). Criar função `categorizarBeneficiosDinamico()` que busca da tabela `benefits` por nome e usa a `category` do banco. Manter fallback simples (default `cobertura`).

### Foco 5 — `restricoesCategorias.ts`: fallback estático `RESTRICOES_CATEGORIA`

**Problema:** 7 categorias com coberturas removidas hardcoded como fallback.

**Solução:** O banco `benefit_category_exclusions` já é fonte primária. Remover `RESTRICOES_CATEGORIA` e `CATEGORIA_LABELS` — mover labels para chaves em `configuracoes` ou inline no código de `gerarMensagemAlertaCategoria()` (que já usa DB como fonte principal). Simplificar funções para usar apenas dados do banco sem fallback estático.

### Foco 6 — `planosPrecos.ts` → banco (dados de referência)

**Problema:** `VEICULOS_ACEITOS`, `MOTOS_ACEITAS`, `GLOSSARIO`, `REGRAS_IMPORTANTES`, `COTAS_TAXAS`, `TAXAS_PROCEDIMENTOS`, `CONTATOS`, `COBERTURAS_ICONES`, `BENEFICIOS_ADICIONAIS_COMPLETO`.

**Solução:**
- `COBERTURAS_ICONES` → Já existe em `main_coverages` (10 registros com icon+subtitle). Usar hook `useMainCoverages()`.
- `BENEFICIOS_ADICIONAIS_COMPLETO` → Já existe em `beneficios_adicionais`. Remover.
- `CONTATOS` → Inserir 3 chaves em `configuracoes` (`contato_cadastro`, `contato_comercial`, `contato_assistencia`). Criar hook `useContatos()`.
- `GLOSSARIO` → Inserir como JSON em `configuracoes` (chave `glossario_consultor`). Criar hook `useGlossario()`.
- `REGRAS_IMPORTANTES` → Inserir como JSON em `configuracoes` (chave `regras_importantes`). Criar hook `useRegrasImportantes()`.
- `COTAS_TAXAS` → Inserir como JSON em `configuracoes` (chave `cotas_taxas`). Criar hook `useCotasTaxas()`.
- `TAXAS_PROCEDIMENTOS` → Inserir como JSON em `configuracoes` (chave `taxas_procedimentos`). Criar hook `useTaxasProcedimentos()`.
- `VEICULOS_ACEITOS` e `MOTOS_ACEITAS` → Inserir como JSON em `configuracoes` (chaves `veiculos_aceitos`, `motos_aceitas`). Criar hook `useVeiculosAceitos()`.

### Foco 7 — Componentes consumidores

- `VeiculosAceitos.tsx` → trocar import estático por `useVeiculosAceitos()`
- `ContatosRapidos.tsx` → trocar import estático por `useContatos()`
- `GlossarioSection.tsx` → trocar imports estáticos por hooks dinâmicos
- `PlanosBeneficios.tsx` → sem mudança (já consome componentes acima)

### Foco 8 — Deletar `src/data/planosPrecos.ts`

Após todas as migrações, o arquivo inteiro pode ser removido. Também remover `RESTRICOES_CATEGORIA` do `restricoesCategorias.ts` (manter apenas funções dinâmicas).

---

## Dados a inserir em `configuracoes`

| Chave | Valor | Tipo |
|---|---|---|
| `taxa_substituicao` | `50` | number |
| `taxa_fallback_carro` | `0.025` | number |
| `taxa_fallback_moto` | `0.03` | number |
| `decomposicao_cota` | `0.60` | number |
| `decomposicao_admin` | `0.25` | number |
| `decomposicao_rastreamento` | `0.10` | number |
| `decomposicao_assistencia` | `0.05` | number |
| `contato_cadastro` | `21 98393-4083` | string |
| `contato_comercial` | `21 99129-6732` | string |
| `contato_assistencia` | `0800 980 0001` | string |
| `glossario_consultor` | (JSON array) | json |
| `regras_importantes` | (JSON array) | json |
| `cotas_taxas` | (JSON array) | json |
| `taxas_procedimentos` | (JSON array) | json |
| `veiculos_aceitos` | (JSON object) | json |
| `motos_aceitas` | (JSON object) | json |

---

## Hooks a criar

| Hook | Fonte | Usado por |
|---|---|---|
| `useBeneficiosAdicionaisCotacao()` | `beneficios_adicionais` | StepBeneficios, StepFinanceiro |
| `useTaxaMensalidade(fipe)` | `tabelas_preco` | StepBeneficios, StepFinanceiro |
| `useRegioes()` | `regioes` | usePlanosCotacao |
| `useContatos()` | `configuracoes` | ContatosRapidos |
| `useGlossario()` | `configuracoes` | GlossarioSection |
| `useRegrasImportantes()` | `configuracoes` | GlossarioSection |
| `useCotasTaxas()` | `configuracoes` | GlossarioSection |
| `useTaxasProcedimentos()` | `configuracoes` | GlossarioSection |
| `useVeiculosAceitos()` | `configuracoes` | VeiculosAceitos |
| `useConfigDecomposicao()` | `configuracoes` | usePlanosCotacao |

---

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/data/planosPrecos.ts` | **Deletar** |
| `src/data/restricoesCategorias.ts` | Remover `RESTRICOES_CATEGORIA` e `CATEGORIA_LABELS`, manter funções dinâmicas |
| `src/hooks/useBeneficiosAdicionaisCotacao.ts` | **Criar** |
| `src/hooks/useRegioes.ts` | **Criar** |
| `src/hooks/useConteudosSistema.ts` | **Criar** (contatos, glossário, regras, cotas, taxas, veículos) |
| `src/hooks/usePlanosCotacao.ts` | Refatorar: regiões dinâmicas, remover fallbacks fixos, ordenar por `ordem` |
| `src/hooks/useCalcularCotacao.ts` | Remover fallback fixo |
| `src/components/substituicao/StepBeneficios.tsx` | Usar hook dinâmico |
| `src/components/substituicao/StepFinanceiro.tsx` | Usar hook dinâmico |
| `src/pages/vendas/Cotacoes.tsx` | Categorização via `benefits.category` |
| `src/components/planos/VeiculosAceitos.tsx` | Usar hook dinâmico |
| `src/components/planos/ContatosRapidos.tsx` | Usar hook dinâmico |
| `src/components/planos/GlossarioSection.tsx` | Usar hooks dinâmicos |

## Ordem de execução

1. Inserir dados em `configuracoes` (migration de dados)
2. Criar hooks (`useBeneficiosAdicionaisCotacao`, `useRegioes`, `useConteudosSistema`)
3. Refatorar `StepBeneficios` + `StepFinanceiro` (Foco 1)
4. Refatorar `usePlanosCotacao` + `useCalcularCotacao` (Focos 2-3)
5. Refatorar `Cotacoes.tsx` (Foco 4)
6. Simplificar `restricoesCategorias.ts` (Foco 5)
7. Refatorar componentes de UI (Focos 6-7)
8. Deletar `planosPrecos.ts` (Foco 8)

