

# Auditoria PARTE 1 — Criação de Planos: Estado Atual vs Requisitos

## Linhas de Produto existentes no banco

| Linha | Slug | Tipo Veículo |
|-------|------|-------------|
| Linha Select | select | car |
| Linha Select One | select-one | car |
| Linha Especial | especial | car |
| Linha Lançamento | lancamento | car |
| Linha Advanced (Motos) | advanced | motorcycle |
| Linha Elétrico | eletrico | car |

## Planos cadastrados (16 total, 13 visíveis na gestão)

```text
LINHA SELECT (4 visíveis + 1 oculto):
  SELECT BASIC         | passeio     | adicional R$0    | cota 6% / min R$1200
  SELECT PREMIUM       | passeio     | adicional R$30   | cota 6% / min R$1200
  SELECT EXCLUSIVE     | passeio     | adicional R$60   | cota 6% / min R$1200
  SELECT EXCLUSIVE APP | aplicativo  | [oculto]         | cota 8% / min R$1200

LINHA SELECT ONE (3 visíveis + 1 oculto):
  SELECT ONE           | passeio     | adicional R$0    | cota 6%/R$1200 + app 8%/R$3000
  SELECT ONE 5% PROMO  | passeio     | desconto 5%      | cota 6%/R$1200 + app 8%/R$3000
  SELECT ONE APP       | aplicativo  | [oculto]         | cota 8% / min R$1200

LINHA ESPECIAL (2):
  ESPECIAL             | passeio     | cota 6% / min R$1200
  ESPECIAL PLUS        | passeio     | cota 10% / min R$3000

LINHA LANÇAMENTO (3 visíveis + 1 oculto):
  LANÇAMENTO BASIC     | passeio     | adicional R$0    | cota 10% / min R$3000
  LANÇAMENTO PREMIUM   | passeio     | adicional R$30   | cota 10% / min R$3000
  LANÇAMENTO EXCLUSIVE | passeio     | adicional R$60   | cota 10% / min R$3000
  LANÇ. EXCLUSIVE APP  | aplicativo  | [oculto]         | cota 8%

ADVANCED (2):
  ADVANCED             | advanced
  ADVANCED+            | advanced-plus

ELÉTRICO (1):
  ELÉTRICOS            | particular
```

## Checklist: O que o formulário de criação JÁ suporta

| Requisito do Diretor | Status | Detalhes |
|----------------------|--------|---------|
| Nome comercial do plano | **OK** | Campo `name` no form |
| Linha de produto | **OK** | Select com `product_lines` |
| Tipo de uso (passeio/aplicativo) | **OK** | Select no form |
| Categorias de veículo aceitas | **PARCIAL** | Checkboxes existem no form, mas o campo `categoria` é salvo como texto CSV e **NÃO é usado** pelo motor de cotação para filtrar |
| Cota de participação por categoria | **PARCIAL** | Existe cota_passeio, cota_app, cota_desagio — mas não por categoria (diesel, moto, etc.) |
| Valor mínimo de cota por categoria | **PARCIAL** | Mesma situação — existe min passeio e min app, mas não por diesel/moto/elétrico |
| Coberturas incluídas por padrão | **OK** | Aba "Benefícios" no form + tabela `planos_beneficios` |
| Tabela de preços por FIPE/região | **PARCIAL** | O form vincula a um `linha_slug` via `plano_preco_map`, mas **não permite cadastrar faixas de preço** diretamente |
| Valor mensal por tipo de uso | **PARCIAL** | As faixas na `tabelas_preco_mensalidade` têm coluna `tipo_uso`, mas não há interface para editar/criar faixas |

## Gaps identificados (o que NÃO funciona ou NÃO existe)

### GAP 1 — Sem CRUD de faixas de preço no formulário de plano
O Diretor precisa cadastrar a grade "faixa FIPE de/até × região × valor mensal passeio × valor mensal aplicativo". Hoje, a vinculação é feita apenas escolhendo um `linha_slug` existente. As faixas em si precisam ser inseridas diretamente no banco. Não há tela para criar/editar faixas de `tabelas_preco_mensalidade`.

### GAP 2 — Categorias de veículo são decorativas
O campo `categoria` existe no form (checkboxes) e é salvo no banco, mas o motor de cotação (`useCalcularCotacao`, `usePlanosCotacao`) **não consulta** esse campo para filtrar planos. A filtragem real acontece apenas por:
- `tipo_uso` (passeio vs aplicativo)
- Faixa FIPE na `tabelas_preco_mensalidade`
- `combustivel_tipo` na tabela de preços

### GAP 3 — Cotas não são segmentadas por categoria de veículo
O requisito pede "percentual de cota por categoria" e "valor mínimo por categoria". O sistema tem apenas 3 pares: passeio (%), passeio (min), deságio (%), deságio (min), app (%), app (min). Falta suporte para diesel, moto, elétrico, especial plus, lançamento como categorias com cotas próprias.

### GAP 4 — Sem edição inline de faixas de preço na Gestão Comercial
A aba "Faixas de Preço" em ProdutosPlanos mostra as faixas em modo somente leitura. Não há botão para adicionar, editar ou remover faixas.

## Proposta de implementação

### Fase 1 — CRUD de Faixas de Preço (prioridade alta)
Adicionar na aba "Faixas de Preço" da Gestão Comercial:
- Botão "Nova Faixa" que abre modal com: FIPE mín, FIPE máx, região, tipo_uso, combustível, valor_mensal, valor_desagio
- Edição inline ou modal para faixas existentes
- Delete com confirmação
- Isso permite ao Diretor montar a grade de preços sem acessar o banco

### Fase 2 — Cotas por categoria de veículo (prioridade média)
Criar tabela `planos_cotas_categoria`:
```text
plano_id | categoria_veiculo | cota_percent | cota_minima
---------|-------------------|-------------|------------
uuid     | passeio           | 6.0         | 1200
uuid     | aplicativo        | 8.0         | 3000
uuid     | diesel            | 8.0         | 2000
```
Atualizar o formulário de plano para editar essas cotas por categoria em vez de campos fixos.

### Fase 3 — Categorias como filtro real na cotação (prioridade média)
Usar o campo `categoria` do plano no motor de cotação para excluir planos incompatíveis com o tipo de veículo do cliente.

---

**Resumo**: A estrutura base de criação de planos está funcional (nome, linha, benefícios, cotas básicas, vinculação de preço). Os 3 gaps principais são: (1) não há CRUD de faixas de preço pela interface, (2) categorias de veículo não filtram na cotação, e (3) cotas não são segmentadas por categoria. Deseja aprovar a implementação começando pela Fase 1?

