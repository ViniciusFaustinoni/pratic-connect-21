

# Remover Taxa Administrativa do Plano (será cobertura comum)

## Contexto

O usuário vai criar a taxa administrativa como uma **cobertura** no catálogo global (`coberturas`), com seu valor próprio. Assim, ela será vinculada aos planos como qualquer outra cobertura, e seu valor já entra automaticamente na soma `somaCoberturas` do motor de cotação.

## O que precisa mudar

### 1. `src/components/gestao-comercial/PlanoFormSheet.tsx`
- Remover todo o **Bloco 3: Taxa Administrativa** da UI (linhas 329-405)
- Remover states: `taxaFipeMin`, `taxaFipeMax`, `taxaIntervalo`, `taxaFaixas`
- Remover funções: `generateTaxaFaixas`, `canGenerateFaixas`
- Remover lógica de save/load de `planos_taxa_administrativa` na mutation e na query de edição
- Remover interface `TaxaFaixa` e import `DollarSign`

### 2. `src/hooks/usePlanosCotacao.ts`
- Remover a query `planos_taxa_administrativa_pricing` (linhas 196-207)
- Remover o cálculo de `taxaAdmin`/`valorTaxaAdmin` (linhas 568-572)
- Remover `valorTaxaAdmin` da soma do `valorMensal` (linha 574): fica apenas `somaCoberturas + somaBeneficios`
- Remover `taxasAdminLoading` das dependências de loading

### 3. `src/hooks/useCotacao.ts`
- Mesmo tratamento: remover busca e cálculo de `planos_taxa_administrativa`
- `valorMensal = somaCoberturas + somaBeneficios` (sem `valorTaxaAdmin`)

### 4. `src/hooks/usePlansAdmin.ts`
- Remover a duplicação de `planos_taxa_administrativa` ao duplicar plano (linhas 370-379)

### 5. Componentes de exibição (manter compatíveis)
- `QuoteCalculatorModal.tsx` — o campo `taxa_administrativa` na cotação continuará funcionando porque vem da decomposição percentual (já calculada sobre `valorMensal`), não da tabela de faixas
- `ExtratoAssociado.tsx` — usa `valor_taxa_administrativa` do rateio, que é independente

### 6. Tabela `planos_taxa_administrativa`
- **Não deletar** a tabela agora (dados históricos de rateios já processados podem referenciar)
- Apenas parar de usar no código

## Impacto no preço
Quando o usuário criar a cobertura "Taxa Administrativa" no catálogo com o valor desejado e vinculá-la aos planos, esse valor entrará automaticamente na soma de coberturas. Não é necessário nenhum ajuste adicional no motor de cotação.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/gestao-comercial/PlanoFormSheet.tsx` | Remover toda UI e lógica de taxa administrativa |
| `src/hooks/usePlanosCotacao.ts` | Remover query e cálculo de `planos_taxa_administrativa` |
| `src/hooks/useCotacao.ts` | Remover query e cálculo de `planos_taxa_administrativa` |
| `src/hooks/usePlansAdmin.ts` | Remover duplicação de taxas ao clonar plano |

