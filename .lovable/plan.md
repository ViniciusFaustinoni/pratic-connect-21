## Problema identificado

A planilha `catalogo_planos_pratic.xlsx` exportada anteriormente contém:
- Aba **Coberturas por Plano**: 2.241 linhas, mas as colunas `Valor Limite`, `Franquia (%)`, `Franquia (R$)`, `Carência (dias)` e o **preço por cobertura** estão todas vazias.
- Aba **Benefícios por Plano**: completamente vazia (apenas cabeçalhos).

**Causa**: o script anterior leu apenas a tabela de override `planos_coberturas` (que tem todos os campos `NULL` neste sistema, exceto `obrigatoria` e `carencia_dias` parcial). Os valores reais ficam no catálogo (`coberturas` e `benefits`) e o join com benefícios não foi feito (ambas as tabelas-ponte `planos_beneficios`/`plan_benefits` estão vazias — os benefícios são vinculados apenas via catálogo clonado por linha).

## Dados disponíveis no banco (verificado)

Tabela `coberturas` (clones por plano):
- `valor_limite` → **0/2865 preenchidos** (não existe no banco — coluna ficará vazia mesmo assim, vamos manter mas marcar "—")
- `franquia_valor` / `franquia_percentual` → **0/2865** (idem)
- `carencia_dias` → **1907/2865** preenchidos ✅
- `valor` (preço/mensalidade da cobertura) → **537/2865** preenchidos ✅
- `percentual_cobertura` → disponível ✅

Tabela `benefits` (catálogo de benefícios):
- `preco_sugerido` → **1770/1770** ✅
- `carencia_dias` → **962/1770** ✅
- `description`, `category`, `display_order` ✅

## Plano de ação

1. **Reescrever o script de exportação** para gerar `catalogo_planos_pratic_v2.xlsx` em `/mnt/documents/`, mantendo as abas existentes e melhorando duas:

   **Aba "Coberturas por Plano"** — buscar direto da tabela `coberturas` (filtrando por linha/plano via slug do nome) com colunas:
   - Linha, Plano, Cobertura, Código, Tipo
   - **% Cobertura** (`percentual_cobertura`)
   - **Valor Limite (R$)** (`valor_limite` — exibe "—" quando nulo)
   - **Franquia (%)** / **Franquia (R$)** (idem)
   - **Carência (dias)** (`carencia_dias`)
   - **Preço Mensal (R$)** (`valor`) ← NOVO
   - **Carência Ativa** (`carencia_ativa`)
   - **Código SGA** (`codigo_sga`)
   - Obrigatória

   **Aba "Benefícios por Plano"** — popular via catálogo `benefits` (já que a ponte está vazia, listar todos os benefícios ativos do catálogo agrupados por linha de produto, ou anexar como aba "Catálogo de Benefícios" geral):
   - Nome, Slug, Categoria, Descrição
   - **Preço Sugerido (R$)** (`preco_sugerido`)
   - **Carência (dias)** + Carência Ativa
   - Código SGA, Display Order, Ativo

2. **Adicionar formatação**:
   - Cabeçalhos em negrito + fundo cinza
   - Valores monetários em formato `R$ #,##0.00;[Red]-R$ #,##0.00;"—"`
   - Zoom 90%, freeze row 1, autofilter

3. **QA**: abrir o xlsx gerado, validar 5 amostras de coberturas com `valor` preenchido e 5 benefícios com `preco_sugerido`.

4. **Entregar** novo arquivo `catalogo_planos_pratic_v2.xlsx` via `<lov-artifact>`.

## Observação importante

`valor_limite` e `franquia_valor`/`franquia_percentual` **não estão preenchidos em nenhum registro do banco** (0/2865). A coluna existirá na planilha mas mostrará "—". Se quiser que esses valores sejam preenchidos, será necessário um trabalho separado de cadastro/importação no catálogo de coberturas — me avise se for o caso.