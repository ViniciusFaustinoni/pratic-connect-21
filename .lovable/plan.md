

# Auditoria Parte 3: Cálculo do Rateio — Diagnóstico e Plano

## Estado Atual — Dois Sistemas Paralelos

O sistema possui **dois mecanismos de rateio completamente independentes** que não conversam entre si:

### Sistema A — `CalcularRateioModal` + `useDiretoria.calcularRateio`
- Grava na tabela `rateios`
- Faz cálculo **errado**: divide total de sinistros pelo número de associados (não por cotas, não por benefício)
- Ignora coberturas — rateia tudo igualmente entre todos
- **Viola todas as regras de negócio descritas na Parte 3**

### Sistema B — `FechamentoMensal` (pipeline de 3 edge functions)
- `fechamento-mensal` → apura despesas por tipo de benefício
- `calcular-rateio-completo` → calcula cotas elegíveis por benefício e valor/cota
- `gerar-faturas-mensais` → gera boletos com composição detalhada por veículo
- **Estruturalmente correto**, mas com lacunas importantes

---

## Problemas Identificados no Sistema B (o correto)

### 1. Adicionais contratados não entram na fatura
`gerar-faturas-mensais` define `adicionais: 0` e `adicionais_detalhes: {}` para todo veículo (linhas 237-238). Nunca consulta `associados_beneficios_adicionais` (tabela criada na Parte 2). O boleto enviado ao associado **não inclui os valores fixos dos adicionais contratados**, violando a regra: "boleto = taxa admin + rateio + adicionais".

### 2. Cota de participação não abate o custo do sinistro
A regra diz: "quando um evento é acionado, o associado sinistrado paga uma cota de participação (% FIPE com mínimo). Esse valor entra como abatimento no custo total do evento." A function `fechamento-mensal` usa `valor_indenizacao` bruto dos sinistros sem subtrair `valor_cota_participacao`, inflando o rateio.

### 3. Categoria "outros" ausente no UI
`DespesaBeneficioCard` no `FechamentoMensal.tsx` não tem label para `outros`, que é uma categoria válida no modo manual.

### 4. Sistema A (legado) causa confusão
O `CalcularRateioModal` e o hook `useDiretoria.calcularRateio` operam sobre a tabela `rateios` (diferente de `fechamentos_mensais`), com lógica flat incorreta. Isso gera ambiguidade sobre qual é o fluxo real.

### 5. Limite de 500 associados no gerador de faturas
`gerar-faturas-mensais` tem `.limit(body.limite || 500)`. Uma base maior que 500 não receberá fatura.

---

## Plano de Implementação

### Fase 1: Incluir adicionais contratados na fatura

**Arquivo**: `supabase/functions/gerar-faturas-mensais/index.ts`

Após buscar os associados, para cada um:
1. Consultar `associados_beneficios_adicionais` filtrando `ativo = true` e `associado_id`
2. Somar valores dos adicionais ativos
3. Preencher `composicao.adicionais` e `composicao.adicionais_detalhes` com os valores reais
4. Incluir no total da fatura

### Fase 2: Abater cota de participação do custo do sinistro

**Arquivo**: `supabase/functions/fechamento-mensal/index.ts`

No modo automático, ao calcular o custo de cada sinistro:
1. Buscar campo `valor_cota_participacao` do sinistro (ou calcular via % FIPE se não preenchido)
2. Subtrair do `valorCusto`: `valorCusto = max(0, valorBruto - cotaParticipacao)`
3. Isso reduz o impacto no rateio conforme a regra de negócio

### Fase 3: Remover sistema legado (Sistema A)

**Arquivos a alterar/remover**:
- `src/components/diretoria/CalcularRateioModal.tsx` — remover ou redirecionar para `FechamentoMensal`
- `src/hooks/useDiretoria.ts` — remover `calcularRateioMutation` e `aprovarRateioMutation` (operam sobre tabela `rateios` legada)
- Verificar se alguma tela referencia `CalcularRateioModal` e substituir

### Fase 4: Corrigir limite de associados e label "outros"

**Arquivos**:
- `supabase/functions/gerar-faturas-mensais/index.ts` — implementar paginação (processar em lotes de 500 até esgotar)
- `src/pages/diretoria/FechamentoMensal.tsx` — adicionar `outros: '📦 Outros'` ao `beneficioLabels`

---

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/gerar-faturas-mensais/index.ts` | Incluir adicionais + paginação |
| `supabase/functions/fechamento-mensal/index.ts` | Abater cota de participação |
| `src/pages/diretoria/FechamentoMensal.tsx` | Adicionar label "outros" |
| `src/components/diretoria/CalcularRateioModal.tsx` | Remover (legado) |
| `src/hooks/useDiretoria.ts` | Remover mutations de rateio legado |
| `src/components/diretoria/index.ts` | Remover export do CalcularRateioModal |

