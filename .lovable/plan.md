
# Corrigir status da etapa de venda para refletir autovistoria em andamento

## Problema

Quando o cliente esta na etapa de autovistoria (enviando fotos), o painel administrativo mostra "Realizando Pagamento" em vez de indicar que a autovistoria esta em andamento.

**Dados reais do cliente FAUSTINONI:**
- `status_contratacao` = `contrato_assinado`
- `contrato.status` = `assinado`
- `adesao_paga` = `false`
- `tipo_vistoria` = `null` (nunca foi atualizado na cotacao)

## Causa raiz (2 problemas)

**Problema 1:** Quando o cliente escolhe "autovistoria" no fluxo `AssociadoVistoria`, o hook `useSelecionarTipoVistoria` atualiza apenas `contratos.tipo_vistoria`. Nao atualiza `cotacoes.status_contratacao` nem `cotacoes.tipo_vistoria`.

**Problema 2:** Na funcao `getEtapaVenda`, a verificacao de pagamento (prioridade 3) tem precedencia sobre tudo: se o contrato esta assinado e `adesao_paga === false`, retorna `realizando_pagamento` independentemente de o cliente estar fazendo autovistoria.

O fluxo do `AssociadoVistoria` e: escolha -> autovistoria -> pagamento. Ou seja, a autovistoria acontece ANTES do pagamento, mas o admin mostra "Realizando Pagamento" prematuramente.

## Solucao

### 1. Atualizar `cotacoes.status_contratacao` ao selecionar tipo de vistoria

**Arquivo:** `src/hooks/useContratoLink.ts` (funcao `useSelecionarTipoVistoria`)

Apos atualizar `contratos.tipo_vistoria`, tambem atualizar `cotacoes.status_contratacao` para `vistoria_ok`. Para isso, buscar a `cotacao_id` do contrato e fazer o update.

### 2. Adicionar etapa "Realizando Autovistoria" no painel

**Arquivos:** `src/components/cotacoes/CotacoesTable.tsx` e `src/components/cotacoes/CotacaoCard.tsx`

- Adicionar `realizando_autovistoria` ao type `EtapaVenda`
- Adicionar configuracao visual (label "Realizando Autovistoria", cor roxa/cyan)
- Na funcao `getEtapaVenda`, ANTES da verificacao de pagamento (prioridade 3), adicionar:

```
// Se autovistoria foi escolhida mas pagamento ainda nao feito,
// significa que o cliente esta na etapa de autovistoria
if (cotacao.tipo_vistoria === 'autovistoria' && adesaoPaga === false) {
  // Verificar se tem vistoria em analise (autovistoria concluida)
  // ou se ainda esta fazendo
  return 'realizando_autovistoria';
}
```

### 3. Atualizar status apos finalizar autovistoria

**Arquivo:** `src/hooks/useContratoLink.ts` (funcao `useFinalizarAutovistoria`)

Ao finalizar a autovistoria, atualizar `cotacoes.status_contratacao` para refletir que a autovistoria foi concluida e agora o proximo passo e o pagamento.

## Arquivos alterados

- `src/hooks/useContratoLink.ts` - 2 pontos: `useSelecionarTipoVistoria` e `useFinalizarAutovistoria`
- `src/components/cotacoes/CotacoesTable.tsx` - tipo, config e logica `getEtapaVenda`
- `src/components/cotacoes/CotacaoCard.tsx` - tipo, config e logica `getEtapaVenda`

## Resultado esperado

- Ao escolher autovistoria: admin mostra "Realizando Autovistoria"
- Ao concluir autovistoria: admin mostra "Realizando Pagamento"
- Fluxo visual correto: Escolha Vistoria -> Realizando Autovistoria -> Realizando Pagamento -> ...
