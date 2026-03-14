

# Fix: Proposta só deve aparecer para analista de cadastro após instalação concluída

## Problema
A query `usePropostasPendentes` (linha 480-525) inclui propostas na fila do analista de cadastro quando:
1. Instalação concluída ✅ (correto)
2. **Autovistoria com fotos** ❌ (incorreto — aparece durante vistoria de instalação)
3. **Vistoria na base realizada** ❌ (incorreto — aparece antes da instalação)

Ou seja, quando o vistoriador/instalador realiza a vistoria e envia fotos, o associado já aparece para o analista aprovar, mesmo sem a instalação ter sido concluída.

## Solução
Simplificar o filtro: a proposta **só aparece** para o analista de cadastro quando `instalacaoInfo` existe (instalação concluída). As vistorias e autovistorias continuam sendo carregadas para exibição, mas não devem ser critério suficiente para incluir a proposta na fila.

## Alteração

**Arquivo:** `src/hooks/usePropostasPendentes.ts` (linhas ~480-525)

Substituir a lógica de filtro:
```typescript
// ANTES (errado):
if (!instalacaoInfo && !temAutovistoria && !temVistoriaBaseRealizada) {
  return null;
}

// DEPOIS (correto):
if (!instalacaoInfo) {
  return null;
}
```

A busca de `vistoriaBaseInfo` e `temAutovistoria` permanece para exibição no painel de análise, mas deixa de ser condição de inclusão na fila.

