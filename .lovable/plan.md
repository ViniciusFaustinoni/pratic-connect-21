

# Diagnostico: Contabilizacao do Custo de OS no Sistema

## Resultado da Analise

Apos investigar todo o fluxo de custos de Ordens de Servico, identifiquei que **o pagamento de OS para oficinas NAO gera lancamento contabil automatico**. Isso significa que esses custos ficam **invisíveis na contabilidade** (balancete, razao, DRE contabil).

## Onde o custo da OS JA aparece corretamente

1. **Fechamento Mensal** (`supabase/functions/fechamento-mensal`): Busca `valor_pago` das OS vinculadas a sinistros para calcular despesas por beneficio. Funciona corretamente.
2. **Custos de Reparos** (`useCustosReparos`): Busca itens de OS (`ordens_servico_itens`) para montar graficos de custos por categoria e tipo de sinistro. Funciona corretamente.
3. **Detalhe da OS** (`OrdemServicoDetalhe`): Exibe valor orcamento, aprovado e pago. Funciona.
4. **Detalhe da Oficina** (`OficinaDetalhe`): Lista pagamentos feitos a oficina via tabela `oficinas_pagamentos`. Funciona.
5. **Relatorios Gerenciais** (`RelatoriosGerenciais`): Busca OS por status e itens para relatorios. Funciona.

## Onde o custo da OS NAO aparece (problema)

1. **Contabilidade (Balancete, Razao, DRE)**: O `RegistrarPagamentoModal` da oficina (`src/components/oficina/RegistrarPagamentoModal.tsx`) registra o pagamento na tabela `oficinas_pagamentos` e atualiza `valor_pago` na OS, mas **nao cria lancamento contabil**. Comparando com o fluxo financeiro:
   - Pagamento de cobranca (`src/components/financeiro/RegistrarPagamentoModal.tsx`) -> chama `criarLancamentoAutomatico` (credito receita, debito caixa)
   - Pagamento de conta (`src/components/financeiro/PagarContaModal.tsx`) -> chama `criarLancamentoAutomatico` (debito despesa, credito caixa)
   - **Pagamento de OS a oficina** -> NAO chama `criarLancamentoAutomatico` (lacuna)

## Correcao Proposta

### Arquivo: `src/components/oficina/RegistrarPagamentoModal.tsx`

Adicionar integracao contabil ao registrar pagamento de OS:

1. Importar `useLancamentosContabeis` e `CONTAS_PADRAO`
2. Apos registrar o pagamento com sucesso na `oficinas_pagamentos`, chamar `criarLancamentoAutomatico` com:
   - **Debito**: `CONTAS_PADRAO.REPAROS_OFICINAS` (conta 5.1.01.002 - Reparos em Oficinas)
   - **Credito**: `CONTAS_PADRAO.BANCO_CONTA_MOVIMENTO` (conta 1.1.01.002 - Banco) ou `CONTAS_PADRAO.CAIXA_GERAL` dependendo da forma de pagamento
   - **Origem**: `'pagamento_oficina'`
   - **Origem ID**: ID do pagamento registrado
   - **Historico**: descritivo com numero da OS e nome da oficina
   - **Valor**: valor efetivamente pago

### Arquivo: `src/lib/contabilidade-config.ts`

Nenhuma alteracao necessaria - as contas `REPAROS_OFICINAS`, `BANCO_CONTA_MOVIMENTO` e `CAIXA_GERAL` ja estao mapeadas.

## Resumo Tecnico

- **1 arquivo alterado**: `src/components/oficina/RegistrarPagamentoModal.tsx`
- Adicionar import de `useLancamentosContabeis` e `CONTAS_PADRAO`
- Chamar `criarLancamentoAutomatico` dentro do `mutationFn`, apos o insert em `oficinas_pagamentos` e update da OS
- Mapear forma de pagamento para conta contabil correta (PIX/transferencia = Banco, outros = Caixa)

