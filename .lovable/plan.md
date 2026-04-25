## Objetivo

Criar um **segundo arquivo XLSX** dedicado a **preços**, vinculável ao `catalogo_planos_pratic_v3.xlsx` pela chave comum **ID Plano** (UUID já presente na aba "Planos" do v3).

Arquivo: **`catalogo_planos_pratic_v3_precos.xlsx`** em `/mnt/documents/`.

## Estrutura proposta (6 abas focadas em preço)

### 1. Índice de Planos (chave de ligação)
Coluna-âncora para PROCV/XLOOKUP no catálogo principal.
- ID Plano · Linha · Plano · Código Plano · Nº Coberturas com preço · Nº Faixas FIPE · Mensalidade Mín (R$) · Mensalidade Máx (R$)

### 2. Preços de Coberturas (preço base)
Apenas linhas com `valor` preenchido em `coberturas`.
- ID Plano · Plano · ID Cobertura · Cobertura · Tipo · % Cobertura · **Preço Mensal Base (R$)** · Carência (dias) · Código SGA

### 3. Preços por Faixa FIPE (matriz completa — long format)
A "fonte da verdade" do motor de cotação.
- ID Plano · Plano · ID Cobertura · Cobertura · Faixa De (R$) · Faixa Até (R$) · **Valor Mensal (R$)**
- ~75k linhas, com auto-filter para isolar plano/cobertura

### 4. Mensalidade Total por Plano × Faixa FIPE
Soma das contribuições de todas as coberturas do plano em cada faixa FIPE — é o que o associado paga.
- ID Plano · Linha · Plano · Faixa De (R$) · Faixa Até (R$) · **Mensalidade Total (R$)** · Nº Coberturas somadas

### 5. Preços de Benefícios (catálogo)
- ID Benefício · Categoria · Nome · **Preço Sugerido (R$)** · Carência (dias) · Carência Ativa · Slug
- 1.770 linhas

### 6. Resumo de Preços por Linha
Visão executiva agregada.
- Linha · Nº Planos · Nº Coberturas · Mensalidade Mín / Média / Máx (R$) · Faixa FIPE atendida (de–até)

## Como conecta com o catálogo v3

Ambas as planilhas compartilham **`ID Plano`** (UUID) como chave primária. Exemplos de fórmula que o usuário poderá usar no Excel:

```text
=XLOOKUP([@ID Plano]; precos.Planos[ID Plano]; precos.Planos[Mensalidade Mín (R$)])
```

E **`ID Cobertura`** (UUID) como chave secundária para detalhar preços por cobertura.

## Padrões de formatação (iguais ao v3)

- Header escuro (#1F2937) + texto branco, congelar linha 1, auto-filter
- Valores monetários: `R$ #,##0.00;[Red]-R$ #,##0.00;"—"`
- IDs em fonte Consolas para facilitar copy/paste
- Ordenação: Linha → Plano → Cobertura

## Fontes de dados (já extraídas)

Reutilizo o dump em `/tmp/fipe/dump.json` (5,2 MB) — não precisa nova chamada à edge function.
- `coberturas.valor` → Preço Base (537/2865)
- `entity_eligibility_rules` (rule_type=`fipe_range`) → Matriz FIPE (75.348 linhas)
- `benefits.preco_sugerido` → Preços de benefícios (1.770/1.770, 100%)

## QA antes de entregar

- Validar 5 amostras: preço de cobertura no v3 == preço no novo arquivo
- Validar soma da Aba 4 == soma manual de 1 plano × 1 faixa
- Validar que todo `ID Plano` da Aba 1 também existe no v3

## Entrega

Arquivo final via `<lov-artifact>` + tabela-resumo de quantas linhas em cada aba.
