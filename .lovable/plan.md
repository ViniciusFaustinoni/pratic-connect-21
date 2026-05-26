## Diagnóstico (evidência real)

Contagem atual no banco das tabelas envolvidas:

| Tabela | Linhas | Status |
|---|---|---|
| `coberturas` | 2.887 | acima do cap |
| `benefits` | 1.777 | acima do cap |
| `planos_coberturas` | 2.263 | acima do cap |
| `planos_beneficios` | 1.334 | acima do cap |
| `entity_eligibility_rules` | 21.439 | muito acima |
| `marcas_modelos` | 12.606 | muito acima |
| `planos` (visivel_gestao=true) | 290 | seguro |
| `tabelas_preco_mensalidade` | 20 | seguro |

## Pontos do Gestão Comercial que truncam hoje (sem `.range()`/`.limit()`/paginação)

Cada item abaixo é uma query real, com caminho e número de linha. Já estão sendo executadas e devolvem no máximo 1000 linhas mesmo precisando de mais.

1. **`src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx:504`** — `from('planos_coberturas').select('cobertura_id, planos(nome)')` (2.263 → 1.000). Mapa de "em quais planos a cobertura está" perde ~1.263 vínculos. É o caso clássico que o usuário descreveu (aba "Coberturas e Benefícios").
2. **`src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx:511`** — `from('planos_beneficios').select('benefit_id, planos(nome)')` (1.334 → 1.000). Mesmo problema para benefícios.
3. **`src/components/gestao-comercial/PlanoFormSheet.tsx:38`** — `from('planos_coberturas').select('cobertura_id').neq('plano_id', planoId)`. Lista de "coberturas já usadas por outros planos" trunca → o sheet de editar plano oferece coberturas que NA VERDADE já estão atribuídas (viola a regra 1:1 de catálogo, ver `mem://architecture/products/plan-item-uniqueness-enforcement`).
4. **`src/components/gestao-comercial/PlanoFormSheet.tsx:47`** — idem para `planos_beneficios` (1.334 rows).
5. **`src/components/gestao-comercial/ProdutosPlanos.tsx:136`** — `from('planos_coberturas').select(...)` (todas as 2.263) usado para montar "coberturas por plano". Planos no fim da lista ficam sem coberturas exibidas.
6. **`src/components/gestao-comercial/ProdutosPlanos.tsx:152`** — `from('planos_beneficios').select(...)` (todas as 1.334). Mesmo efeito para benefícios.
7. **`src/components/gestao-comercial/ProdutosPlanos.tsx:90`** — `from('associados').select('plano_id').eq('status','ativo')`. Contagem de associados por plano fica capada em 1.000 (subestima volumes).
8. **`src/hooks/useMarcasModelos.ts:25`** — `from('marcas_modelos').select('*')` (12.606 → 1.000). É o hook usado pela aba "Marcas e Modelos" do Gestão Comercial e por `useDetectarTipoVeiculo`/`useEnriquecerVeiculo`. Hoje só "vemos" 1.000 marcas+modelos no admin.

## Já corretos (não mexer)

- `useCoberturas` (`src/hooks/usePlans.ts:445`) — paginado em chunks de 1000.
- `useBenefits` (`src/hooks/usePlans.ts:375`) — paginado em chunks de 1000.
- `useAllEligibilityRules` (`src/hooks/useEntityEligibilityRules.ts:49`) — paginado.
- `useLinhasComPlanos` (`src/components/gestao-comercial/LinhasPlanos.tsx:243-298`) — chunked por `plano_id` + `range(0,9999)` para `planos_coberturas`, `planos_beneficios` e `entity_eligibility_rules`.
- `usePlans` (`src/hooks/usePlans.ts:173`) — top-level é `planos` (290 rows), seguro.

## Achados que NÃO são bug (informe ao usuário)

- **`src/components/gestao-comercial/BeneficiosCoberturas.tsx`** existe mas **não é importado em lugar nenhum** (`grep` em `src/` só encontra a própria definição). É código morto — não causa o problema relatado.
- **`src/components/gestao-comercial/ElegibilidadeVeiculos.tsx`** lê `plano_elegibilidade_modelos` que hoje tem **0 linhas** (tabela legada, ver core memory). Os selects sem `.range()` ali não estão causando truncamento real hoje, mas a tela está usando uma fonte deprecada — fora do escopo deste fix.
- **`src/components/gestao-comercial/TabelaPrecosTab.tsx`** lê `tabelas_preco_mensalidade` (20 rows) e `plano_preco_map` (0 rows). Sem risco hoje.
- **`SimuladorRateio.tsx`** consulta `veiculos`/`sinistros` mas é a aba "Simulador de Rateio" e usa agregação por contagem, não listagem — fora do escopo do que o usuário descreveu ("ver todos os planos/benefícios/coberturas"). Sinalizo se quiser que eu inclua.

## Correções propostas (somente front-end, sem mexer no banco)

Padrão único para todas as 8 queries listadas: paginação por `range()` em chunks de 1.000 até `rows.length < pageSize`, idêntico ao já usado em `useCoberturas`/`useBenefits`. Para os mapas atribuição→plano da aba Catálogo, mantenho o shape de retorno; só passa a varrer a tabela inteira.

Arquivos que serão editados:

- `src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx` — paginar as duas queries de atribuição (linhas 501-514).
- `src/components/gestao-comercial/PlanoFormSheet.tsx` — paginar as duas queries de IDs atribuídos (linhas 35-52).
- `src/components/gestao-comercial/ProdutosPlanos.tsx` — paginar `associados.plano_id`, `planos_coberturas` e `planos_beneficios` (linhas 86-161).
- `src/hooks/useMarcasModelos.ts` — paginar `useMarcasModelos()` (linha 25).

Extração: criar um helper minúsculo `src/lib/data/fetchAllPaginated.ts` para evitar repetir a mesma estrutura `while(true) { range(); }` em 8 lugares. Tudo passa a usar esse helper.

## Out of scope (pergunto antes)

- Corrigir o legado `plano_elegibilidade_modelos` na aba Elegibilidade.
- Refatorar `BeneficiosCoberturas.tsx` (código morto) — remover ou ressuscitar?
- Bug colateral no Catálogo: cada cobertura/benefício só guarda **um** nome de plano no `cobAttrMap`/`benAttrMap` (o último iterado). É uma limitação visual à parte. Posso incluir nesta passagem se quiser que vire lista de planos.