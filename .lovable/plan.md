

# Preencher Espaço Vazio na Situação Financeira

## Problema

O card "Situação Financeira" (coluna direita do grid em `AssociadoSituacaoCard`) mostra apenas o status de inadimplência ("Adimplente") e fica com muito espaço vazio, enquanto cards abaixo (Plano & Contrato, Vencimentos, Consultor Vinculado) repetem informações em cards separados.

## Solução

Mover as informações de **Plano & Contrato**, **Vencimentos** e **Consultor Vinculado** para dentro do card "Situação Financeira", preenchendo o espaço vazio. Remover os cards duplicados do `AssociadoResumoTab`.

## Alterações

### 1. `src/components/associados/detalhe/AssociadoSituacaoCard.tsx`

Expandir o card "Situação Financeira" adicionando após o status de inadimplência:
- **Plano & Contrato**: nome do plano, mensalidade, dia vencimento, início contrato
- **Vencimentos**: próxima mensalidade, CNH vence, CRLV vence
- **Consultor Vinculado**: nome e pontuação (já existe no card, mover para dentro do financeiro)

Para isso, o componente precisa receber props adicionais: `associado`, `contrato`, `resumoFinanceiro` (mesmos dados já passados ao `AssociadoResumoTab`).

Atualizar a interface `Props` para aceitar esses dados opcionais.

### 2. `src/components/associados/detalhe/AssociadoResumoTab.tsx`

- Passar `associado`, `contrato` e `resumoFinanceiro` para `AssociadoSituacaoCard`
- Remover o grid de "Plano & Contrato" e "Vencimentos" (linhas 113-145) pois estará consolidado
- O card de Consultor Vinculado já está no `AssociadoSituacaoCard`, então remover da lista separada se duplicado

### Layout Final do Card Situação Financeira

```text
┌─────────────────────────────────────┐
│ Situação Financeira                 │
│ ✓ Adimplente                        │
│                                     │
│ ─── Plano & Contrato ───           │
│ Plano          Select Exclusive     │
│ Mensalidade    R$ 180,00            │
│ Dia venc.      Todo dia 10          │
│ Início         01/04/2026           │
│                                     │
│ ─── Vencimentos ───                │
│ Mensalidade    —                    │
│ CNH vence      17/01/2033           │
│ CRLV vence     Não informado        │
│                                     │
│ ─── Consultor ───                  │
│ Nome           [TESTE] Vendedor CLT │
│ Pontuação      ☆ 0 pts              │
└─────────────────────────────────────┘
```

## Impacto
- 2 arquivos alterados
- Cards redundantes removidos, layout mais compacto
- Nenhuma funcionalidade perdida

