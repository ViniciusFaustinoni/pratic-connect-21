
# Conectar FaturamentoMensal ao Rateio Mutualista Real

## Problema Atual

A tela `FaturamentoMensal.tsx` faz um calculo simplificado: busca `contratos.valor_mensal` e insere direto em `asaas_cobrancas`. Ignora completamente:
- O pipeline de fechamento (`fechamentos_mensais`)
- O calculo de rateio por cota/beneficio (`calcular-rateio-completo`)
- A geracao real de faturas (`gerar-faturas-mensais`) que inclui pro-rata, composicao detalhada e integracao ASAAS

A edge function e os hooks (`useFechamentoMensal.ts`) ja existem e estao completos. O problema e que a tela nao os usa.

## Solucao

Reescrever `FaturamentoMensal.tsx` para seguir o pipeline real de 3 etapas:

```text
ETAPA 1: FECHAR MES          ETAPA 2: CALCULAR RATEIO       ETAPA 3: GERAR FATURAS
(fechamento-mensal)     -->   (calcular-rateio-completo) -->  (gerar-faturas-mensais)
Status: aberto->fechado       Status: fechado->aprovado       Status: aprovado->processado
```

## Arquivo a Modificar

### `src/pages/financeiro/FaturamentoMensal.tsx` (reescrita completa)

**Importar hooks existentes:**
- `useFechamento` — busca fechamento do mes/ano selecionado
- `useFechamentosMensais` — historico
- `useExecutarFechamento` — etapa 1
- `useCalcularRateio` — etapa 2
- `useGerarFaturas` — etapa 3 (com `preview: true` e `preview: false`)
- `useCobrancasFechamento` — listar cobrancas geradas

**Nova estrutura da tela:**

1. **Seletor de Periodo** (manter igual)

2. **Cards KPI** (4 cards, agora com dados reais do fechamento):
   - Total Associados Ativos (do `fechamento.total_associados_ativos`)
   - Total Cotas Ativas (do `fechamento.total_cotas_ativas`)
   - Total Despesas Rateio (do `fechamento.total_despesas_rateio`)
   - Valor Medio por Cota (calculado: total_despesas / total_cotas)

3. **Pipeline de 3 Etapas** (Stepper visual com estado):

   **Etapa 1 — Fechar Mes** (se nao existe fechamento ou status='aberto'):
   - Card explicando: "Apurar todas as despesas com sinistros do periodo"
   - Botao "Fechar Mes" → chama `useExecutarFechamento({ mes, ano })`
   - Apos fechar, mostra resumo com total de despesas por tipo

   **Etapa 2 — Calcular Rateio** (se status='fechado'):
   - Exibe despesas por beneficio (tabela): tipo, valor total, cotas elegiveis, valor/cota
   - Botao "Calcular e Aprovar Rateio" → chama `useCalcularRateio({ fechamento_id, aprovar: true, profile_id })`
   - Apos calcular, atualiza valores na tabela

   **Etapa 3 — Gerar Faturas** (se status='aprovado'):
   - **Botao "Simular Faturas"** → chama `useGerarFaturas({ fechamento_id, preview: true })`
   - Mostra tabela de preview: associado, placa(s), cotas, taxa admin, rateio, pro-rata, total
   - Cards resumo: total faturas, valor total, boleto medio, 10 maiores
   - **Botao "Gerar Faturas no ASAAS"** → chama `useGerarFaturas({ fechamento_id, preview: false, enviar_whatsapp: true })`
   - Dialogo de confirmacao antes de gerar (acao irreversivel)
   - Apos gerar: mostra resultado (X geradas, Y erros, Z WhatsApp enviados)

   **Processado** (se status='processado'):
   - Badge verde "Faturamento concluido"
   - Link para ver cobrancas geradas (`/financeiro/cobrancas?competencia=...`)

4. **Tabela de Despesas do Rateio** (quando fechamento existe):
   - Tipo beneficio, descricao, valor total, qtd eventos, cotas elegiveis, valor por cota
   - Dados vem de `fechamento.despesas_rateio`

5. **Preview/Simulacao de Faturas** (secao expansivel):
   - Estado local `previewData` alimentado pelo retorno de `useGerarFaturas` com `preview: true`
   - Tabela com colunas: Associado, Veiculos, Cotas, Taxa Admin, Rateio, Pro-rata, Total
   - Filtro por nome/CPF
   - Ordenacao por valor (maior primeiro)
   - Cards: Total estimado, Boleto medio, Maior boleto, Menor boleto

6. **Historico de Faturamentos** (manter, mas usar `useFechamentosMensais`):
   - Referencia, status (com badge colorido do pipeline), total despesas, total faturado, recebido, pendente, data

## Detalhes Tecnicos

- Remover toda a logica de mutation `gerarFaturamentoMutation` que insere direto em `asaas_cobrancas`
- Remover a query `associados-para-faturar` que busca `contratos.valor_mensal`
- Usar exclusivamente os hooks de `useFechamentoMensal.ts` que ja chamam as 3 edge functions
- O preview retorna array de faturas com `composicao_total`, `composicao_resumo.veiculos[]` — usar para montar a tabela
- O stepper visual usa o campo `fechamento.status` para determinar qual etapa esta ativa
- Nenhuma dependencia nova necessaria
- Nenhuma migracao de banco necessaria
- Nenhuma alteracao em edge functions necessaria

## Ordem de Implementacao

1. Reescrever `FaturamentoMensal.tsx` com imports dos hooks existentes
2. Implementar o stepper de 3 etapas com estados condicionais
3. Implementar a secao de preview/simulacao com tabela detalhada
4. Manter historico usando `useFechamentosMensais` em vez da query direta
