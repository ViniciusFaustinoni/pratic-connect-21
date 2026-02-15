

# Fase 5-5: Modulo Contabilidade Completo conforme Especificacao

## Resumo

O modulo de contabilidade existe com estrutura basica funcional, mas esta significativamente simplificado em relacao a especificacao completa. Esta fase implementa todas as lacunas identificadas para atingir o funcionamento completo descrito no documento.

---

## Gaps Identificados (Atual vs Especificacao)

### 1. Plano de Contas Incompleto
O plano atual tem ~47 contas. A especificacao exige ~120+ contas detalhadas. Faltam categorias inteiras:
- Ativo: PDD, Adiantamentos, Estoques (rastreadores, salvados), Imobilizado completo, Intangivel
- Passivo: Provisoes (sinistros, indenizacoes, contingencias), contribuicoes antecipadas, valores a restituir
- Patrimonio Social: superavits/deficits acumulados, reservas estatutarias, fundo de reserva
- Despesas: toda a estrutura de beneficios mutualistas (reparos, indenizacoes, assistencia 24h, sindicancia, rastreamento), administrativas detalhadas, juridicas, marketing, depreciacao, provisoes
- Receitas: contribuicao ABP, coparticipacao, vistoria, troca de titularidade, salvados, receitas financeiras

### 2. Dashboard Contabil Limitado
- Atual: 4 KPIs (Receitas, Despesas, Resultado, Lancamentos) + 1 grafico donut
- Especificacao: 6 KPIs (Ativo Total, Passivo Total, Patrimonio Social, Receita Acumulada Ano, Despesa Acumulada Ano, Resultado Exercicio) + 4 graficos + sistema de alertas

### 3. DRE Simplificado
- Atual: lista plana de receitas e despesas, resultado unico
- Especificacao: DRE estruturado com 8 secoes (Receitas Operacionais, Despesas com Beneficios Mutualistas, Resultado Operacional Bruto, Despesas Administrativas, Resultado Operacional Liquido, Resultado Financeiro, Outras Receitas, Tributos, Superavit/Deficit) + indicadores calculados (sinistralidade, custo administrativo, margens) + comparacao com periodo anterior

### 4. Balancete sem Saldo Anterior
- Falta: coluna saldo anterior, niveis de detalhamento (sintetico/analitico), comparacao com periodo anterior

### 5. Balanco Patrimonial sem Comparacao
- Falta: coluna exercicio anterior lado a lado, analise vertical (% do total), analise horizontal (variacao %), notas explicativas

### 6. Fechamento Incompleto
- Falta: checklist completo com 10 itens, reabertura com motivo e aprovacao, fechamento anual (apuracao do resultado, transferencia para PL, geracao de demonstrativos finais)

---

## Implementacao

### Etapa 1 — Expandir Plano de Contas (SQL INSERT)

Inserir todas as contas faltantes no banco via ferramenta de insert. Nao e migracao (sao dados, nao schema). Reorganizar a numeracao conforme especificacao:

- Grupo 1: Ativo (circulante + nao circulante) — ~25 novas contas
- Grupo 2: Passivo (circulante + nao circulante + patrimonio social) — ~25 novas contas
- Grupo 3: Despesas (beneficios mutualistas, administrativas, financeiras, tributarias, depreciacao, provisoes) — ~40 novas contas
- Grupo 4: Receitas (contribuicoes, outras operacionais, financeiras) — ~15 novas contas

Atualizar `src/lib/contabilidade-config.ts` com os novos IDs das contas inseridas.

### Etapa 2 — Dashboard Contabil Completo

Reescrever `src/pages/contabilidade/ContabilidadeDashboard.tsx`:

**6 KPIs:**
- Ativo Total: soma saldos devedores das contas grupo 1
- Passivo Total: soma saldos credores das contas grupo 2 (exceto PL)
- Patrimonio Social: Ativo - Passivo
- Receita Acumulada (ano): soma receitas do exercicio corrente
- Despesa Acumulada (ano): soma despesas do exercicio corrente
- Resultado do Exercicio: Receita - Despesa (superavit/deficit com cor)

**4 Graficos (recharts):**
- Receita vs Despesa por Mes (BarChart agrupado, 12 meses)
- Composicao do Ativo (PieChart: caixa, contas a receber, imobilizado, outros)
- Composicao das Despesas por natureza (PieChart: beneficios, administrativas, pessoal, tributarias, depreciacao)
- Evolucao do Patrimonio Social (LineChart, 12 meses)

**Alertas:**
- Vermelho: resultado mensal deficitario, PL caindo ha 3 meses, lancamentos pendentes
- Amarelo: fechamento atrasado, provisoes nao registradas, divergencia financeiro/contabilidade
- Azul: obrigacoes acessorias com prazo proximo

### Etapa 3 — DRE Estruturado

Reescrever `src/pages/contabilidade/DRE.tsx`:

**Estrutura do DRE:**
```text
RECEITAS OPERACIONAIS
  Contribuicoes Mensais
  Taxas de Adesao
  Cotas de Coparticipacao
  Contribuicao ABP
  Taxas de Vistoria e Outros
TOTAL RECEITAS OPERACIONAIS

(-) DESPESAS COM BENEFICIOS MUTUALISTAS
  Reparos de Veiculos
  Indenizacoes
  Assistencia 24h
  Sindicancia e Pericia
  Rastreamento
TOTAL DESPESAS COM BENEFICIOS

RESULTADO OPERACIONAL BRUTO
  Margem bruta: X%

(-) DESPESAS ADMINISTRATIVAS
  Pessoal
  Gerais
  Tecnologia
  Juridicas
  Marketing
  Depreciacao e Amortizacao
  Provisao PDD
TOTAL DESPESAS ADMINISTRATIVAS

RESULTADO OPERACIONAL LIQUIDO

(+/-) RESULTADO FINANCEIRO
  Receitas Financeiras
  (-) Despesas Financeiras

(+/-) OUTRAS RECEITAS/DESPESAS
  Venda de Salvados
  Recuperacao de Despesas
  Multas e Juros Recebidos

RESULTADO ANTES DOS TRIBUTOS

(-) TRIBUTOS

SUPERAVIT (DEFICIT) DO EXERCICIO
  Margem final: X%
```

**Indicadores calculados:**
- Sinistralidade: despesas beneficios / receita total (ideal < 65%)
- Custo Administrativo: despesas admin / receita total (ideal < 25%)
- Margem Operacional: resultado operacional / receita total
- Margem Final: superavit / receita total

**Comparacao com periodo anterior** (coluna lado a lado) e analise horizontal (variacao %).

**Periodo:** opcao de mensal ou exercicio completo (acumulado Jan-Dez).

### Etapa 4 — Balancete Aprimorado

Modificar `src/pages/contabilidade/Balancete.tsx`:

- Adicionar coluna **Saldo Anterior** (buscar saldos do mes anterior)
- Seletor de **nivel de detalhamento** (sintetico nivel 2 / analitico nivel 4 / personalizado)
- Botao **Comparar com Periodo Anterior** (mostra 2 periodos lado a lado)
- Exportar Excel (CSV ja existe)

### Etapa 5 — Balanco Patrimonial Aprimorado

Modificar `src/pages/contabilidade/BalancoPatrimonial.tsx`:

- Adicionar coluna **Exercicio Anterior** (buscar dados do mesmo mes do ano anterior)
- **Analise Vertical**: % de cada linha em relacao ao total do grupo
- **Analise Horizontal**: variacao % de cada linha vs exercicio anterior
- Toggle para mostrar/ocultar analises
- Campo **Notas Explicativas** (textarea para o contador)
- Titulo correto: "Patrimonio Social" ao inves de "Patrimonio Liquido"

### Etapa 6 — Fechamento Completo

Reescrever `src/pages/contabilidade/Fechamentos.tsx`:

**Checklist de Fechamento Mensal (10 itens):**
1. Todos os lancamentos automaticos classificados
2. Conciliacao bancaria concluida
3. Depreciacao mensal registrada
4. PDD atualizada
5. Provisao ferias e 13o atualizada
6. Provisao para sinistros atualizada
7. Impostos apurados e registrados
8. Balancete confere (diferenca = 0)
9. Receitas e despesas revisadas
10. Nenhum lancamento pendente de aprovacao

Itens 3, 8, 10 podem ser verificados automaticamente pelo sistema. Os demais sao marcados manualmente pelo contador.

**Reabertura:**
- Botao "Reabrir Periodo" nos meses fechados
- Dialog com campo motivo (obrigatorio)
- Registro de quem reabriu, quando, motivo
- Status muda para "reaberto"

**Fechamento Anual:**
- Botao "Fechar Exercicio [ano]" — so disponivel quando 12 meses fechados
- Apuracao automatica: Total Receitas - Total Despesas = Superavit/Deficit
- Lancamento automatico de transferencia para PL (zera contas 3 e 4, transfere para 2.3)
- Geracao dos demonstrativos finais (Balanco + DRE do exercicio)
- Calendario de obrigacoes acessorias com alertas (DCTF, ECD, ECF)

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/contabilidade/AlertasContabeis.tsx` | Sistema de alertas contabeis (vermelho/amarelo/azul) |
| `src/components/contabilidade/ChecklistFechamento.tsx` | Checklist de 10 itens para fechamento mensal |
| `src/components/contabilidade/FechamentoAnual.tsx` | Dialog/fluxo de fechamento do exercicio |
| `src/components/contabilidade/IndicadoresDRE.tsx` | Cards de indicadores (sinistralidade, margens) |

## Arquivos a Modificar

| Arquivo | Mudancas |
|---------|----------|
| `src/pages/contabilidade/ContabilidadeDashboard.tsx` | Reescrever: 6 KPIs, 4 graficos, alertas |
| `src/pages/contabilidade/DRE.tsx` | Reescrever: estrutura completa, indicadores, comparacao |
| `src/pages/contabilidade/Balancete.tsx` | Adicionar saldo anterior, niveis, comparacao |
| `src/pages/contabilidade/BalancoPatrimonial.tsx` | Adicionar exercicio anterior, analise V/H, notas |
| `src/pages/contabilidade/Fechamentos.tsx` | Checklist completo, reabertura, fechamento anual |
| `src/hooks/useContabilidade.ts` | Novos hooks: useAtivoTotal, usePassivoTotal, usePatrimonioSocial, useDREEstruturado, useReabrirFechamento, useFechamentoAnual |
| `src/lib/contabilidade-config.ts` | Atualizar mapeamentos com novos IDs de contas |
| `src/components/contabilidade/index.ts` | Exportar novos componentes |

## Dados a Inserir (SQL INSERT — nao migracao)

Inserir ~80 novas contas no plano de contas seguindo a estrutura completa da especificacao. Exemplo das categorias principais:
- 1.1.02.003 a 1.1.02.005 (Contas a Receber detalhadas + PDD)
- 1.1.03.x (Adiantamentos)
- 1.1.04.x (Estoques: rastreadores, salvados)
- 1.2.x (Imobilizado, Intangivel com depreciacao/amortizacao)
- 2.1.01.003 a 2.1.01.005 (Fornecedores detalhados)
- 2.1.02.x (Obrigacoes trabalhistas detalhadas)
- 2.1.03.x (Obrigacoes fiscais detalhadas)
- 2.1.04.x (Provisoes: sinistros, indenizacoes, contingencias)
- 2.1.05.x (Outras obrigacoes)
- 2.2.x (Passivo nao circulante)
- 2.3.x (Patrimonio Social completo) — reajustar do grupo 3 atual para grupo 2.3
- 3.1.x a 3.6.x (Despesas detalhadas) — reajustar do grupo 5 atual
- 4.1.x a 4.3.x (Receitas detalhadas) — reajustar do grupo 4 atual

**Nota importante:** A numeracao atual usa 1-5 (1=Ativo, 2=Passivo, 3=PL, 4=Receitas, 5=Despesas). A especificacao usa 1-4 (1=Ativo, 2=Passivo+PL, 3=Despesas, 4=Receitas). Como ja existem lancamentos com as contas atuais, NÃO vamos renumerar — vamos adicionar as contas faltantes DENTRO da estrutura existente (grupos 1-5 atuais), mantendo compatibilidade com lancamentos ja registrados.

## Detalhes Tecnicos

- Todos os calculos de KPI usam regime de competencia (data_competencia)
- Graficos usam recharts (ja instalado): BarChart, PieChart, LineChart, ResponsiveContainer
- Saldo anterior calculado via soma de partidas ate o ultimo dia do mes anterior
- Comparacao com periodo anterior: query duplicada com datas do ano anterior
- Fechamento anual gera lancamento automatico via `useLancamentosContabeis.criarLancamentoAutomatico`
- Checklist persistido no campo JSONB existente ou em nova coluna no fechamentos_contabeis
- Nenhuma nova tabela necessaria — a estrutura de banco atual suporta tudo

