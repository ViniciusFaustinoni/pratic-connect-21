

# Auditoria PARTE 4 — Interface do Diretor: Estado Atual vs Requisitos

## Estrutura atual da Gestão Comercial (4 abas)

| Aba | Componente | Função |
|-----|-----------|--------|
| Produtos & Planos | `ProdutosPlanos.tsx` | Master-detail: lista lateral de planos + painel com sub-abas (Faixas de Preço, Coberturas, Benefícios, Detalhes) |
| Benefícios & Coberturas | `BeneficiosCoberturas.tsx` | CRUD de benefícios de marketing (`benefits`) + coberturas de display (`main_coverages`) |
| Tabela de Preços | `TabelaPrecosTab.tsx` | CRUD completo de `tabelas_preco_mensalidade` com filtros, import/export CSV, histórico |
| Adicionais | `BeneficiosAdicionaisConfig.tsx` | CRUD de benefícios adicionais pagos (`beneficios_adicionais`) com preço, linhas permitidas, regiões |

## Páginas separadas já existentes

| Página | Rota | Função |
|--------|------|--------|
| Faixas & Cotas | `/diretoria/faixas-cotas` | Grade editável de `faixas_cotas` com ajuste percentual por faixa FIPE, contagem de associados, simulação de impacto, histórico |
| Fechamento & Rateio | `/diretoria/fechamento` | Visualização de `fechamentos_mensais` (agora read-only, consome Sistema B) |
| Rateio Config | `/diretoria/configuracoes` | Parâmetros atuariais: valor por cota, multiplicadores, taxa admin, dias de fechamento/vencimento |

## Checklist: Requisitos da PARTE 4 vs Estado Atual

### ÁREA 1 — Gestão de Planos

| Requisito | Status | Onde |
|-----------|--------|------|
| Listagem com nome, linha, status, associados | **OK** | `ProdutosPlanos.tsx` — sidebar com badge de contagem |
| Formulário em etapas (nome, linha) | **PARCIAL** | `PlanFormModal.tsx` usa tabs, não wizard sequencial — funcional mas não impede pular etapas |
| Categorias de veículo aceitas | **OK** | Checkboxes no form |
| Cota de participação por categoria | **PARCIAL** | Apenas cota_passeio/app/desagio — não por diesel/moto/elétrico |
| Coberturas incluídas por padrão | **OK** | Sub-aba Coberturas com vincular/editar/desvincular |
| Adicionais compatíveis com plano | **PARCIAL** | Benefícios de marketing (`benefits`) são vinculados, mas adicionais pagos (`beneficios_adicionais`) usam `linhas_permitidas` na própria config — não há vínculo direto plano↔adicional |
| Grade de preços por FIPE/região | **OK** | Sub-aba Faixas de Preço (read-only) + aba Tabela de Preços (CRUD) |
| Plano só ativa com coberturas+preços | **OK** | Validação no toggle ativo/inativo |
| Plano ativo não pode ser excluído | **OK** | Botão bloqueado com toast |
| Alerta de associados ao inativar | **OK** | Dialog com contagem |

### ÁREA 2 — Gestão de Benefícios Adicionais

| Requisito | Status | Onde |
|-----------|--------|------|
| Listagem com nome, valor, planos, associados | **OK** | `BeneficiosAdicionaisConfig.tsx` — tabela completa |
| CRUD (nome, descrição, valor, linhas permitidas) | **OK** | Dialog com form completo |
| Alerta "alteração vale para novos contratos" | **OK** | Alert amarelo no dialog de edição |
| Preço por região | **OK** | Checkboxes de regiões com preço regional no form |

### ÁREA 3 — Tabela de Quotas (Atuarial)

| Requisito | Status | Onde |
|-----------|--------|------|
| Grade editável faixa FIPE × categoria | **PARCIAL** | `FaixasCotas.tsx` tem grade por faixa FIPE, mas **apenas ajuste percentual** — não segmenta por categoria (passeio/app/moto/diesel) nas colunas |
| Contagem de associados por faixa | **OK** | Badge com contagem ao lado de cada linha |
| Alterações só valem no próximo ciclo | **OK** | Informado na UI |
| Histórico versionado | **OK** | Tab de histórico com data/hora/autor |
| Simulação de impacto | **OK** | `SimulacaoImpactoCard` com custo base simulado |

### ÁREA 4 — Simulador de Rateio

| Requisito | Status | Onde |
|-----------|--------|------|
| Simulação por mês de referência | **NÃO EXISTE** | Não há tela dedicada de simulação de rateio |
| Projeção valor por benefício | **NÃO EXISTE** | — |
| Impacto médio por associado | **NÃO EXISTE** | — |
| Confirmação de fechamento pelo Diretor | **PARCIAL** | O wizard de fechamento fica em `/financeiro/faturamento`, não na Diretoria |

## O que MANTER como está

1. **Aba "Produtos & Planos"** — estrutura master-detail funcional e completa. Apenas pequenos ajustes necessários.
2. **Aba "Adicionais"** (`BeneficiosAdicionaisConfig`) — CRUD robusto, atende todos os requisitos da Área 2.
3. **Aba "Tabela de Preços"** — CRUD com import/export, filtros, histórico. Completo.
4. **Página "Faixas & Cotas"** — grade editável com simulação e histórico. Base sólida.
5. **Validações de ativação/inativação de plano** — lógica correta e implementada.

## O que precisa ser ADAPTADO

### Adaptação 1 — Grade de Cotas por Categoria (Faixas & Cotas)
A grade atual mostra apenas um ajuste percentual por faixa FIPE. O requisito pede colunas por categoria (passeio, aplicativo, moto, diesel, elétrico) com valor de cota específico. Isso requer:
- Adicionar colunas à tabela `faixas_cotas` (ou criar tabela relacional `faixas_cotas_categorias`)
- Atualizar a grade para exibir e editar cotas por categoria
- Manter a simulação de impacto com a nova estrutura

### Adaptação 2 — Cotas por Categoria no Formulário de Plano
O `PlanFormModal` tem campos fixos (cota_passeio, cota_app, cota_desagio). O requisito pede que, para cada categoria marcada no plano, o Diretor informe % de cota e valor mínimo. Isso pode ser feito:
- Renderizando campos dinâmicos por categoria selecionada
- Salvando em `planos_cotas_categoria` (tabela nova proposta na Fase 2 da PARTE 1)

### Adaptação 3 — Aba "Benefícios & Coberturas" — Dualidade confusa
Esta aba mistura dois conceitos diferentes: benefícios de marketing (`benefits`) e coberturas de display (`main_coverages`). Ambos são itens de apresentação visual que já estão vinculados aos planos na sub-aba de Produtos & Planos. A aba funciona, mas é redundante com a sub-aba do plano. Sugestão: manter como catálogo centralizado (o que já é), mas adicionar um label mais claro sobre a diferença entre os dois.

## O que precisa ser CRIADO

### Criação 1 — Simulador de Rateio (Área 4)
Criar nova aba na Gestão Comercial ou nova página na Diretoria com:
- Select de mês de referência
- Busca de eventos aprovados no período + base ativa
- Cálculo projetado: custo por benefício ÷ cotas elegíveis = valor/cota
- Tabela com impacto médio por associado (amostra ou total)
- Botão "Confirmar Fechamento" que redireciona ao wizard de Faturamento ou dispara diretamente

### Criação 2 — Tabela `planos_cotas_categoria`
Nova tabela para armazenar cotas segmentadas:
```text
plano_id | categoria_veiculo | cota_percentual | cota_minima_valor
```
Isso substitui os campos fixos `cota_passeio`, `cota_app`, `cota_desagio` no plano.

## Resumo de ações

| Prioridade | Ação | Tipo |
|-----------|------|------|
| Alta | Criar Simulador de Rateio | Nova feature |
| Alta | Criar `planos_cotas_categoria` + form dinâmico | Schema + UI |
| Média | Expandir Faixas & Cotas com colunas por categoria | UI refactor |
| Baixa | Clarificar labels na aba Benefícios & Coberturas | UI polish |

Tudo consolidado no menu Gestão Comercial como solicitado — o Simulador de Rateio seria uma 5ª aba ou integrado à página de Fechamento existente.

