

## Plano: Corrigir reset do contato IA após exclusão de cotação

### Problema
Ao excluir uma cotação, a IA continua a conversa anterior em vez de reiniciar o fluxo. O screenshot mostra a IA retomando de onde parou (perguntando dia 10 ou 20 com datas erradas).

### Causa raiz
O `delete-cotacao` (linha 302-308) faz reset do contato usando `.eq('telefone', telefoneNormalizado)`, mas há um **mismatch de formato de telefone**:

- `agente_ia_contatos.telefone` armazena `telLimpo` que pode ser `"21999999999"` (sem DDI) ou `"5521999999999"` (com DDI)
- `cotacao.telefone1_solicitante` pode estar em formato diferente
- Se os formatos não coincidem, o `UPDATE` não encontra o registro e o reset **falha silenciosamente**

Além disso, mesmo quando o telefone coincide, o histórico de mensagens WhatsApp anterior ao reset pode "vazar" se o `limiteHistorico` (linha 205-207) não filtrar corretamente as mensagens enviadas pela própria IA segundos antes da exclusão.

### Correções

**1. `supabase/functions/delete-cotacao/index.ts` (linhas 302-309)**
Buscar o contato usando TODAS as variantes do telefone (com e sem DDI 55), garantindo o match:

```typescript
const telefoneNormalizado = cotacao.telefone1_solicitante.replace(/\D/g, '');
const agora = new Date().toISOString();

// Tentar ambas as variantes: com e sem DDI
const variantes = [telefoneNormalizado];
if (telefoneNormalizado.startsWith('55') && telefoneNormalizado.length >= 12) {
  variantes.push(telefoneNormalizado.substring(2));
} else {
  variantes.push('55' + telefoneNormalizado);
}

await adminClient
  .from('agente_ia_contatos')
  .update({ status: 'novo', dados_cotacao: null, resetado_em: agora })
  .in('telefone', variantes);
```

Aplicar a mesma lógica de variantes ao cancelamento da fila IA (linhas 312-317).

**2. `supabase/functions/agente-consultor-ia/index.ts` (linhas 200-229)**
Reforçar o reset: além de checar `status === 'novo' && !dados_cotacao`, verificar também se `resetado_em` existe e é recente (< 24h). Isso cobre edge cases onde o status pode ter mudado entre o reset e a próxima mensagem:

```typescript
const foiResetado = contatoExistente && (
  (contato?.status === 'novo' && !contato?.dados_cotacao) ||
  (contato?.resetado_em && !contato?.dados_cotacao)
);
```

**3. Redeploy das duas Edge Functions**
- `delete-cotacao`
- `agente-consultor-ia`

### Resultado esperado
- Ao excluir uma cotação, o contato IA será sempre encontrado independentemente do formato do telefone
- A IA reiniciará do zero na próxima mensagem, sem contexto da conversa anterior
- As datas de vencimento serão as corretas (correção anterior já deployada)

