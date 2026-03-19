

# Calculadora Aprimorada — Regras do Cotador + Atalho para Cotação

## Resumo

Melhorar a Calculadora de Preço existente para exibir informações completas de cada plano (como no cotador), mantendo a simplicidade de consulta rápida. Ao final, um botão "Ir para Cotação" abre o CotacaoFormDialog já pré-preenchido com os dados informados na calculadora.

## Status: ✅ Implementado

### O que foi feito

1. **CalculadoraPreco.tsx** — Refatorado para exibir por plano:
   - Valor mensal (já existia)
   - Taxa de adesão
   - Cota de participação (percentual + mínimo)
   - Cobertura FIPE (%)
   - Coberturas resumidas (até 6 itens)
   - Opções de vencimento do dia atual
   - Botão "Criar Cotação" em cada plano

2. **PlanosBeneficios.tsx** — Adicionado:
   - State para `cotacaoBase` e `cotacaoDialogOpen`
   - Callback `handleIrParaCotacao` que converte dados da calculadora para o formato do CotacaoFormDialog
   - CotacaoFormDialog renderizado com prop `cotacaoBase` preenchida

## Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `src/components/planos/CalculadoraPreco.tsx` | Refatorado: dados extras, botão "Criar Cotação" |
| `src/pages/vendas/PlanosBeneficios.tsx` | Adicionado CotacaoFormDialog com dados da calculadora |
