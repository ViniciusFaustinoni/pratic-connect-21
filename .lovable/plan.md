

## Plano: Corrigir badge "Associado Ativo" exibida prematuramente

### Problema
A função `getEtapaVenda` verifica o status do associado (`ativo`) com prioridade alta, sem considerar o status do contrato **desta cotação específica**. Se o associado já é ativo por outro motivo (plano anterior, migração), toda nova cotação mostra "Associado Ativo" mesmo sem assinatura do termo.

### Solução

**Arquivo: `src/components/cotacoes/CotacoesTable.tsx`** (e lógica espelhada em `CotacaoCard.tsx`)

Alterar a condição na linha 194 para só mostrar "Associado Ativo" quando o contrato **desta cotação** também estiver em status final (assinado ou ativo):

```typescript
// ANTES
if (associadoStatus === 'ativo') return 'associado_ativo';

// DEPOIS — só mostra se o contrato desta cotação foi assinado/ativo
if (associadoStatus === 'ativo' && contratoStatus && ['assinado', 'ativo'].includes(contratoStatus)) {
  return 'associado_ativo';
}
```

Isso garante que a badge só aparece quando o fluxo contratual desta cotação foi concluído, não apenas porque o associado já era ativo.

### Arquivos alterados
- `src/components/cotacoes/CotacoesTable.tsx`
- `src/components/cotacoes/CotacaoCard.tsx` (mesma lógica duplicada)
- `src/components/cotacoes/CotacaoDetalhesModal.tsx` (se tiver lógica similar)

