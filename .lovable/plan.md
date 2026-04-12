

## Plano: Exibir motivos nos logs de auditoria

### Problema
Os diálogos de exclusão (cotação, sinistro, associado, chamado) coletam o motivo do usuário, mas:
1. **Cotação**: o motivo nunca é enviado à Edge Function `delete-cotacao` — é descartado
2. **Log display**: o componente `LogSistemaTab.tsx` não exibe os campos `dados_anteriores`/`dados_novos` onde o motivo poderia estar armazenado
3. Mesmo nos fluxos que já enviam motivo (sinistro, chamado), ele fica "escondido" no JSON e não aparece na UI

### Solução

**1. Passar motivo na exclusão de cotação**
- `useExcluirCotacao` (useCotacoes.ts): aceitar `{ cotacaoId, motivo }` em vez de apenas `cotacaoId`
- `delete-cotacao` Edge Function: ler `motivo` do body e incluir no log de auditoria (`dados_novos: { motivo }`)
- `Cotacoes.tsx`: passar motivo ao chamar `excluirCotacao.mutateAsync`

**2. Exibir motivo no log do sistema**
- `LogSistemaTab.tsx`: após a descrição, verificar se `log.dados_novos?.motivo` ou `log.dados_anteriores?.motivo` existe e exibi-lo com um ícone/label "Motivo:"

### Alterações

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useCotacoes.ts` | `useExcluirCotacao` recebe `{ cotacaoId, motivo }` |
| `src/pages/vendas/Cotacoes.tsx` | Passa motivo ao `mutateAsync` |
| `src/pages/vendas/CotacaoDetalhe.tsx` | Passa motivo ao `mutate` |
| `supabase/functions/delete-cotacao/index.ts` | Lê motivo do body, inclui em `dados_novos` do log |
| `src/components/gestao-comercial/LogSistemaTab.tsx` | Exibe motivo quando presente nos dados do log |

### Escopo
- 5 arquivos modificados
- Redeploy de 1 Edge Function (`delete-cotacao`)
- Sem migração SQL

