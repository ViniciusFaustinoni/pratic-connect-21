

## Plano: Sincronizar badges com etapas reais do fluxo de contratação

### Problema
A cotação de Adriano Rodrigues Fernandes está na etapa de assinatura (contrato existe com status `visualizado`), mas o badge mostra "Escolha de Vistoria". Isso acontece porque:

1. O contrato foi criado com status `pendente_assinatura`
2. Quando o cliente abriu o documento no Autentique, o webhook atualizou o status para `visualizado`
3. A lógica de badge só reconhece `pendente_assinatura` como etapa de assinatura (linha 194), ignorando `visualizado` e `enviado`
4. Como `contratoStatus === 'visualizado'` não é capturado, o fluxo cai no `status_contratacao === 'documentos_ok'` (linha 254), que retorna `'escolha_vistoria'`

### Solução

**Arquivos: `src/components/cotacoes/CotacoesTable.tsx` e `src/components/cotacoes/CotacaoCard.tsx`**

Na função `getEtapaVenda`, expandir a verificação da PRIORIDADE 0 (linha 194 em ambos os arquivos):

```typescript
// PRIORIDADE 0: Se contrato em fase de assinatura (pendente, enviado ou visualizado)
if (contratoStatus && ['pendente_assinatura', 'enviado', 'visualizado'].includes(contratoStatus)) {
  return 'assinando_contrato';
}
```

Isso garante que qualquer contrato que ainda não foi assinado (independente de ter sido enviado, visualizado ou estar pendente) mostre o badge correto "Assinando Contrato".

### Arquivos alterados
- `src/components/cotacoes/CotacoesTable.tsx` (linha 194)
- `src/components/cotacoes/CotacaoCard.tsx` (linha 192)

