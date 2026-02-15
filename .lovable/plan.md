
# Expansao do Plano de Contas + Ajustes Finais do Modulo Contabilidade

## Contexto

A implementacao anterior (Fase 5-5) ja entregou toda a estrutura de UI: Dashboard com 6 KPIs e 4 graficos, DRE estruturado com indicadores, Balancete com saldo anterior e niveis, Balanco Patrimonial com comparacao e analise V/H, e Fechamentos com checklist de 10 itens e reabertura.

O que falta e a **expansao do plano de contas no banco de dados** (de 47 para ~120 contas) e ajustes pontuais no codigo para cobrir secoes do DRE que a especificacao exige (Tributos, Depreciacao).

---

## Etapa 1 — Inserir contas faltantes no banco

O plano atual tem 47 contas. A especificacao exige ~120. As contas serao inseridas mantendo a estrutura existente (grupos 1-5), sem renumerar contas com lancamentos.

### Grupo 1 — ATIVO (novas contas)

- 1.1.01.003 Banco Conta Movimento (Bradesco) — pai: 1.1.01
- 1.1.01.004 Aplicacoes Financeiras de Liquidez Imediata — pai: 1.1.01
- 1.1.01.005 Conta ASAAS (Gateway) — pai: 1.1.01
- 1.1.02.003 Cotas de Eventos a Receber — pai: 1.1.02
- 1.1.02.004 Outras Receitas a Receber — pai: 1.1.02
- 1.1.02.005 (-) Provisao para Devedores Duvidosos (PDD) — pai: 1.1.02
- 1.1.03 Adiantamentos e Depositos (sintetica) — pai: 1.1
- 1.1.03.001 Adiantamento a Fornecedores — pai: 1.1.03
- 1.1.03.002 Adiantamento a Funcionarios — pai: 1.1.03
- 1.1.03.003 Despesas Pagas Antecipadamente — pai: 1.1.03
- 1.1.04 Estoques (sintetica) — pai: 1.1
- 1.1.04.001 Rastreadores em Estoque — pai: 1.1.04
- 1.1.04.002 Salvados — pai: 1.1.04
- 1.2 ATIVO NAO CIRCULANTE (sintetica) — pai: 1
- 1.2.01 Imobilizado (sintetica) — pai: 1.2
- 1.2.01.001 Moveis e Utensilios — pai: 1.2.01
- 1.2.01.002 Equipamentos de Informatica — pai: 1.2.01
- 1.2.01.003 Veiculos da Associacao — pai: 1.2.01
- 1.2.01.004 Instalacoes e Benfeitorias — pai: 1.2.01
- 1.2.01.005 (-) Depreciacao Acumulada — pai: 1.2.01
- 1.2.02 Intangivel (sintetica) — pai: 1.2
- 1.2.02.001 Software — pai: 1.2.02
- 1.2.02.002 (-) Amortizacao Acumulada — pai: 1.2.02

### Grupo 2 — PASSIVO (novas contas)

- 2.1.01.003 Prestadores de Servico a Pagar — pai: 2.1.01
- 2.1.01.004 Assistencia 24h a Pagar — pai: 2.1.01
- 2.1.01.005 Outros Fornecedores a Pagar — pai: 2.1.01
- 2.1.02.002 FGTS a Recolher — pai: 2.1.02
- 2.1.02.003 INSS a Recolher — pai: 2.1.02
- 2.1.02.004 IRRF a Recolher — pai: 2.1.02
- 2.1.02.005 Ferias e 13o Provisionados — pai: 2.1.02
- 2.1.02.006 Comissoes a Pagar — pai: 2.1.02
- 2.1.03.002 COFINS a Recolher — pai: 2.1.03
- 2.1.03.003 ISS a Recolher — pai: 2.1.03
- 2.1.03.004 IRPJ a Recolher — pai: 2.1.03
- 2.1.03.005 CSLL a Recolher — pai: 2.1.03
- 2.1.04 Provisoes (sintetica) — pai: 2.1
- 2.1.04.001 Provisao para Sinistros — pai: 2.1.04
- 2.1.04.002 Provisao para Indenizacoes — pai: 2.1.04
- 2.1.04.003 Provisao para Contingencias Judiciais — pai: 2.1.04
- 2.1.05 Outras Obrigacoes (sintetica) — pai: 2.1
- 2.1.05.001 Contribuicoes Recebidas Antecipadamente — pai: 2.1.05
- 2.1.05.002 Valores a Restituir a Associados — pai: 2.1.05
- 2.2 PASSIVO NAO CIRCULANTE (sintetica) — pai: 2
- 2.2.01 Provisoes de Longo Prazo (sintetica) — pai: 2.2
- 2.2.01.001 Provisao para Contingencias LP — pai: 2.2.01

### Grupo 3 — PATRIMONIO SOCIAL (adequar nomenclatura)

- Renomear grupo 3 de "PATRIMONIO LIQUIDO" para "PATRIMONIO SOCIAL"
- Renomear 3.1 de "Capital Social" para "Patrimonio Social Inicial"
- 3.2.02 Fundo de Reserva para Sinistros — pai: 3.2
- Renomear 3.3 para "Superavits/Deficits Acumulados"
- 3.3.01 Superavits Acumulados — pai: 3.3
- 3.3.02 Deficits Acumulados — pai: 3.3
- 3.4 Superavit/Deficit do Exercicio Corrente — pai: 3

### Grupo 4 — RECEITAS (novas contas)

- 4.1.01.002 Contribuicao Associativa ABP — pai: 4.1.01
- 4.1.01.003 Cotas de Coparticipacao em Eventos — pai: 4.1.01
- 4.1.02.002 Taxas de Vistoria — pai: 4.1.02
- 4.1.02.003 Taxas de Troca de Titularidade — pai: 4.1.02
- 4.2 OUTRAS RECEITAS OPERACIONAIS (sintetica) — pai: 4
- 4.2.01 Outras Receitas (sintetica) — pai: 4.2
- 4.2.01.001 Receita com Venda de Salvados — pai: 4.2.01
- 4.2.01.002 Recuperacao de Despesas — pai: 4.2.01
- 4.2.01.003 Receitas Eventuais — pai: 4.2.01
- 4.3 RECEITAS FINANCEIRAS (sintetica) — pai: 4
- 4.3.01 Receitas Financeiras (sintetica) — pai: 4.3
- 4.3.01.001 Rendimentos de Aplicacoes Financeiras — pai: 4.3.01
- 4.3.01.002 Juros Recebidos — pai: 4.3.01
- 4.3.01.003 Descontos Obtidos — pai: 4.3.01

### Grupo 5 — DESPESAS (novas contas)

- 5.1.01.003 Servicos de Prestadores — pai: 5.1.01
- 5.1.01.004 Pintura — pai: 5.1.01
- 5.1.02.003 Carro Reserva — pai: 5.1.02
- 5.1.02.004 Outros Servicos de Assistencia — pai: 5.1.02
- 5.1.03.003 Beneficios (VT, VR, plano de saude) — pai: 5.1.03
- 5.1.03.004 Ferias e 13o — pai: 5.1.03
- 5.1.03.005 Comissoes de Consultores — pai: 5.1.03
- 5.1.03.006 Comissoes de Reguladores — pai: 5.1.03
- 5.1.04.005 Limpeza e Conservacao — pai: 5.1.04
- 5.2 DESPESAS COM BENEFICIOS DETALHADAS (sintetica) — nao criar, ja mapeado em 5.1.01/5.1.02
- 5.2 Despesas com Tecnologia (sintetica) — pai: 5
- 5.2.01 Tecnologia (sintetica) — pai: 5.2
- 5.2.01.001 Sistemas e Software — pai: 5.2.01
- 5.2.01.002 Gateway de Pagamento (ASAAS) — pai: 5.2.01
- 5.2.01.003 Hospedagem e Dominio — pai: 5.2.01
- 5.2.01.004 Desenvolvimento de Software — pai: 5.2.01
- 5.3 Despesas Juridicas (sintetica) — pai: 5
- 5.3.01 Juridicas (sintetica) — pai: 5.3
- 5.3.01.001 Honorarios Advocaticios — pai: 5.3.01
- 5.3.01.002 Custas Judiciais — pai: 5.3.01
- 5.3.01.003 Despesas com Cartorio e SPC/Serasa — pai: 5.3.01
- 5.4 Despesas com Marketing (sintetica) — pai: 5
- 5.4.01.001 Publicidade e Propaganda — pai: 5.4
- 5.4.01.002 Eventos e Patrocinios — pai: 5.4
- 5.4.01.003 Materiais Impressos — pai: 5.4
- 5.5 Despesas Tributarias (sintetica) — pai: 5
- 5.5.01.001 PIS sobre Receita — pai: 5.5
- 5.5.01.002 COFINS sobre Receita — pai: 5.5
- 5.5.01.003 ISS — pai: 5.5
- 5.5.01.004 IRPJ — pai: 5.5
- 5.5.01.005 CSLL — pai: 5.5
- 5.5.01.006 IPTU — pai: 5.5
- 5.6 Depreciacao e Amortizacao (sintetica) — pai: 5
- 5.6.01.001 Depreciacao de Imobilizado — pai: 5.6
- 5.6.01.002 Amortizacao de Intangivel — pai: 5.6
- 5.7 Provisoes (sintetica) — pai: 5
- 5.7.01.001 Provisao para Devedores Duvidosos — pai: 5.7
- 5.7.01.002 Provisao para Contingencias — pai: 5.7
- 5.8 Despesas com Sindicancia e Pericia (sintetica) — pai: 5
- 5.8.01.001 Empresas de Sindicancia — pai: 5.8
- 5.8.01.002 Pericia Tecnica — pai: 5.8
- 5.9 Despesas com Rastreamento (sintetica) — pai: 5
- 5.9.01.001 Mensalidade de Rastreadores — pai: 5.9
- 5.9.01.002 Instalacao de Rastreadores — pai: 5.9
- 5.9.01.003 Manutencao de Rastreadores — pai: 5.9

Total: ~75 novas contas a inserir.

---

## Etapa 2 — Renomear contas existentes

- `3` PATRIMONIO LIQUIDO -> PATRIMONIO SOCIAL
- `3.1` Capital Social -> Patrimonio Social Inicial
- `3.3` Resultado Acumulado -> Superavits/Deficits Acumulados
- `2.1.03.001` Impostos a Pagar -> PIS a Recolher (primeiro imposto, os demais serao novas contas)

---

## Etapa 3 — Atualizar DRE para incluir secoes faltantes

Modificar `useDREEstruturado` em `src/hooks/useContabilidade.ts` para adicionar secoes:

- **Despesas com Sindicancia/Pericia**: prefixo `5.8`
- **Despesas com Rastreamento**: prefixo `5.9`
- **Despesas com Tecnologia**: prefixo `5.2`
- **Despesas Juridicas**: prefixo `5.3`
- **Despesas com Marketing**: prefixo `5.4`
- **Tributos**: prefixo `5.5`
- **Depreciacao e Amortizacao**: prefixo `5.6`
- **Provisoes**: prefixo `5.7`

Reorganizar o DRE conforme especificacao:

```text
RECEITAS OPERACIONAIS (4.1)
(-) DESP. BENEFICIOS MUTUALISTAS (5.1.01, 5.1.02, 5.8, 5.9)
RESULTADO OPERACIONAL BRUTO
(-) DESP. ADMINISTRATIVAS (5.1.03, 5.1.04, 5.2, 5.3, 5.4, 5.6, 5.7)
RESULTADO OPERACIONAL LIQUIDO
(+/-) RESULTADO FINANCEIRO (4.3 - 5.1.05)
(+/-) OUTRAS RECEITAS (4.2)
RESULTADO ANTES DOS TRIBUTOS
(-) TRIBUTOS (5.5)
SUPERAVIT/DEFICIT DO EXERCICIO
```

Modificar `src/pages/contabilidade/DRE.tsx` para renderizar a secao de Tributos e Resultado Antes dos Tributos.

---

## Etapa 4 — Atualizar contabilidade-config.ts

Apos inserir as contas, capturar os IDs gerados e atualizar `CONTAS_PADRAO` com as novas contas relevantes para lancamentos automaticos:
- PDD, Provisao para Sinistros, Provisao para Indenizacoes
- Novas contas de receita (ABP, coparticipacao, vistoria)
- Novas contas de despesa detalhadas

Atualizar `RECEITA_POR_TIPO` e `DESPESA_POR_CATEGORIA` com mapeamentos mais precisos.

---

## Etapa 5 — Atualizar Dashboard para novos prefixos de despesa

Modificar o agrupamento de despesas por natureza no dashboard (`ContabilidadeDashboard.tsx`) para reconhecer os novos prefixos:
- `5.1.01`, `5.1.02`, `5.8`, `5.9` -> Beneficios/Sinistros
- `5.1.03` -> Pessoal
- `5.1.04`, `5.2` -> Administrativas/Tecnologia
- `5.1.05` -> Financeiras
- `5.3` -> Juridicas
- `5.4` -> Marketing
- `5.5` -> Tributarias
- `5.6` -> Depreciacao

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useContabilidade.ts` | Atualizar `useDREEstruturado` com novos prefixos e secao de tributos |
| `src/pages/contabilidade/DRE.tsx` | Renderizar secao Tributos e Resultado Antes dos Tributos |
| `src/pages/contabilidade/ContabilidadeDashboard.tsx` | Atualizar agrupamento de despesas por natureza |
| `src/lib/contabilidade-config.ts` | Adicionar novos IDs de contas e mapeamentos |

## SQL a Executar no SQL Editor

Um grande bloco INSERT com ~75 contas + UPDATE para renomear as existentes. Sera fornecido como SQL para execucao manual.

---

## Detalhes Tecnicos

- INSERTs usam `gen_random_uuid()` para gerar IDs
- Contas sinteticas: `sintetica = true`, `aceita_lancamento = false`
- Contas analiticas: `sintetica = false`, `aceita_lancamento = true`
- Natureza: ativo = devedora, passivo/PL/receita = credora, despesa = devedora
- Ordem segue o codigo numerico
- Apos INSERT, consultar IDs gerados para atualizar `contabilidade-config.ts`
