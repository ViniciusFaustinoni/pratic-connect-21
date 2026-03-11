

# Auditoria PARTE 3 — Cálculo do Rateio: Estado Atual vs Requisitos

## Dois sistemas paralelos detectados

O sistema possui **duas implementações concorrentes** de rateio que não conversam entre si:

### Sistema A — `RateioSinistros.tsx` (Diretoria)
- Usa tabela `rateios` + `rateios_detalhes` + `rateios_detalhes_faixas`
- Calcula via mutation local no frontend: busca sinistros aprovados, soma, divide por cotas
- Usa `fn_calcular_rateio_por_cotas` (SQL) para ajustes por faixa FIPE
- **NÃO segmenta despesas por tipo de benefício** — calcula um valor global por cota
- Fluxo: Calcular → Aprovar → Aplicar (sem gerar faturas)

### Sistema B — `FaturamentoMensal.tsx` (Financeiro)
- Usa tabela `fechamentos_mensais` + `despesas_rateio`
- Wizard de 3 etapas com Edge Functions:
  1. `fechamento-mensal` — apura despesas (manual ou automática) e segmenta por benefício
  2. `calcular-rateio-completo` — calcula valor/cota POR BENEFÍCIO (cotas elegíveis por cobertura)
  3. `gerar-faturas-mensais` — gera boletos no Asaas com composição detalhada
- **Este é o fluxo correto** conforme a PARTE 3 do requisito

## Checklist: Requisitos vs Implementação

| Requisito | Sistema A (Diretoria) | Sistema B (Financeiro) |
|-----------|----------------------|----------------------|
| Rateio por benefício separado | **NÃO** — valor global | **SIM** — `despesas_rateio` por tipo |
| Cotas elegíveis por cobertura | **NÃO** | **SIM** — filtra veículos por `cobertura_*` |
| Cota de participação abate custo | **NÃO** — usa `valor_indenizacao` bruto | **SIM** — `Math.max(0, valorBruto - cotaParticipacao)` |
| Taxa administrativa + rateio + adicionais | **NÃO** | **SIM** — `ComposicaoFatura` |
| Pró-rata para novos associados | **NÃO** | **SIM** — `calcularProRata()` |
| Multi-veículo por associado | **NÃO** | **SIM** — soma composições de cada veículo |
| Geração de boletos Asaas | **NÃO** | **SIM** |
| Preview antes de gerar | **NÃO** | **SIM** |

## Gaps identificados no Sistema B (o correto)

### GAP 1 — Cotas hardcoded como fallback
Em `gerar-faturas-mensais` linha 224:
```text
const cotas = v.quantidade_cotas || (v.faixas_cotas)?.quantidade_cotas || Math.ceil(valorFipe / 5000);
```
O fallback `Math.ceil(valorFipe / 5000)` é um hardcode. Se o veículo não tem cotas definidas, ele inventa um valor. Deveria usar a configuração `atuarial_valor_por_cota` da tabela `configuracoes`.

### GAP 2 — `calcular-rateio-completo` não abate cota de participação
A Edge Function `calcular-rateio-completo` recebe `valor_total` das `despesas_rateio` e divide por cotas — mas o abatimento da cota de participação só acontece no `fechamento-mensal`. Se o Diretor entrar despesas manuais, a cota de participação NÃO é abatida (já que ele informa o valor final). Isso é correto para manual, mas deveria ser documentado na UI.

### GAP 3 — Sistema A (Diretoria) é redundante e incorreto
O `RateioSinistros.tsx` faz cálculos locais que NÃO segmentam por benefício e NÃO geram faturas. Ele salva na tabela `rateios` que o Sistema B NÃO consulta. Os dois fluxos coexistem sem integração — um Diretor pode calcular em ambos e obter valores diferentes.

### GAP 4 — `valor_fipe` fallback perigoso
Em `gerar-faturas-mensais` linha 221:
```text
const valorFipe = v.valor_fipe || 50000;
```
Se o veículo não tem FIPE cadastrado, assume R$ 50.000. Isso distorce a taxa administrativa e as cotas.

### GAP 5 — Limite de 1000 registros do Supabase
A query de associados ativos em `gerar-faturas-mensais` não usa paginação. Com mais de 1000 associados ativos, o sistema silenciosamente ignora os excedentes.

## Proposta de implementação

### Correção 1 — Unificar fluxo de rateio (prioridade alta)
Deprecar o Sistema A (`RateioSinistros.tsx`) ou transformá-lo em visualização do Sistema B. A tela da Diretoria deveria exibir os dados de `fechamentos_mensais` + `despesas_rateio` em vez de fazer cálculos próprios na tabela `rateios`.

### Correção 2 — Remover hardcodes de fallback (prioridade alta)
- Substituir `Math.ceil(valorFipe / 5000)` por busca na configuração `atuarial_valor_por_cota`
- Substituir `v.valor_fipe || 50000` por log de alerta + skip do veículo (ou usar valor real do contrato)
- Substituir `faixa?.valor_taxa || 49.90` por busca na configuração `taxa_administrativa_padrao`

### Correção 3 — Paginação para bases grandes (prioridade média)
Adicionar loop de paginação na query de associados em `gerar-faturas-mensais` para suportar mais de 1000 associados.

### Correção 4 — Alerta na UI sobre despesas manuais (prioridade baixa)
Adicionar nota no wizard de fechamento: "No modo manual, informe os valores já descontando a cota de participação dos associados sinistrados."

### Arquivos afetados
- `src/pages/diretoria/RateioSinistros.tsx` — refatorar para consumir `fechamentos_mensais`
- `supabase/functions/gerar-faturas-mensais/index.ts` — remover hardcodes, adicionar paginação
- `supabase/functions/fechamento-mensal/index.ts` — paginação na contagem de associados
- `src/pages/financeiro/FaturamentoMensal.tsx` — alerta sobre modo manual

