

# Refatorar Motor de Cotação: Preço = Soma dos Itens + Taxa Administrativa

## Contexto

O motor de cotação atual busca o preço mensal na tabela `tabelas_preco_mensalidade` (tabela de preços por faixa FIPE). Essa tabela é obsoleta. O novo modelo de precificação é:

```text
valor_mensal = Σ coberturas.valor (via planos_coberturas)
             + Σ benefits.preco_sugerido (via planos_beneficios)
             + taxa_administrativa (via planos_taxa_administrativa, por faixa FIPE)
```

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/hooks/usePlanosCotacao.ts` | Refatorar pricing principal |
| `src/hooks/useCotacao.ts` | Refatorar pricing secundário |

## Detalhes técnicos

### 1. `usePlanosCotacao.ts` — Hook principal da tela de cotação

**Remover:**
- Query `plano_preco_map` (linhas 182-193)
- Query `tabelas_preco_mensalidade` (linhas 195-208)
- Bloco de pricing antigo (linhas 561-613) que busca `valorMensal` via `tabelasMensalidade`
- Dependências de `tabelasMensalidadeLoading` e `planoPrecoMapLoading` no flag de loading crítico

**Adicionar:**
- Query `planos_coberturas` com join `coberturas(valor)` para todos os planos ativos
- Query `planos_taxa_administrativa` para todos os planos ativos
- Alterar a query de `planos_beneficios` existente (linha 170) para incluir `benefits:benefit_id(id, name, category, preco_sugerido)`

**Novo cálculo de preço** (substituir linhas 561-613):
```ts
// Soma dos valores das coberturas vinculadas ao plano
const somaCoberturas = coberturasMap.get(plano.id) || 0;

// Soma dos valores dos benefícios vinculados (usando preco_sugerido)
const somaBeneficios = (plano.planos_beneficios || [])
  .reduce((acc, pb) => acc + ((pb.benefits as any)?.preco_sugerido || 0), 0);

// Taxa administrativa por faixa FIPE
const taxaAdmin = taxasAdminData
  ?.filter(t => t.plano_id === plano.id)
  ?.find(t => valorFipe >= t.fipe_de && valorFipe <= t.fipe_ate);
const valorTaxaAdmin = taxaAdmin?.valor_taxa || 0;

let valorMensal = somaCoberturas + somaBeneficios + valorTaxaAdmin;

// Se o plano não tem itens configurados, ocultar
if (valorMensal === 0) continue;
```

### 2. `useCotacao.ts` — Hook secundário (criação de cotações)

**Remover:**
- `usePlanoPrecoMap()` (linhas 100-112)
- `useTabelasMensalidade()` (linhas 114-127)
- `useConfigAdicionalApp()` (linhas 133-174)
- `encontrarFaixaMensalidade()` (linhas 180-232)

**Adicionar:**
- Queries para coberturas, benefícios e taxa administrativa
- Novo cálculo dentro de `useCalcularCotacao` usando soma dos itens + taxa

**Novo `useCalcularCotacao`:** Em vez de chamar `encontrarFaixaMensalidade`, calcular diretamente:
```ts
// Para cada plano disponível:
const somaCob = cobValores.get(plano.id) || 0;
const somaBen = benValores.get(plano.id) || 0;
const taxa = taxasAdmin
  ?.filter(t => t.plano_id === plano.id)
  ?.find(t => valorFipe >= t.fipe_de && valorFipe <= t.fipe_ate);
const valorMensal = somaCob + somaBen + (taxa?.valor_taxa || 0);

if (valorMensal <= 0) continue;
```

## O que NÃO muda

- Regras de elegibilidade (FIPE, ano, modelo, região, categoria)
- Decomposição do valor mensal (cota, admin, rastreamento, assistência)
- Cota de participação e deságio
- Lógica de coberturas removidas por categoria
- Adicional mensal e desconto percentual do plano (continuam aplicados sobre o total)

