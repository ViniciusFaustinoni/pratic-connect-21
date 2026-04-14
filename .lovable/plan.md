

## Plano: Reiniciar conversa da IA quando cotação for excluída

### Problema
Quando uma cotação gerada pela IA é excluída pelo painel, o registro em `agente_ia_contatos` mantém `status: "cotacao_enviada"` e `dados_cotacao` com todo o estado antigo. Se o lead enviar nova mensagem, a IA não reinicia o fluxo.

### Correção

**Arquivo: `supabase/functions/delete-cotacao/index.ts`**

Após a exclusão da cotação (antes do log de auditoria, ~linha 299), adicionar lógica para:

1. Buscar o `telefone1_solicitante` da cotação (adicionar ao SELECT na linha 68)
2. Se existir telefone, buscar o registro correspondente em `agente_ia_contatos` pelo telefone
3. Resetar o contato: `status = "novo"`, `dados_cotacao = null`

Isso fará com que, na próxima mensagem do lead, a IA trate como conversa nova e reinicie o fluxo de cotação.

### Detalhes técnicos

```typescript
// No SELECT da cotação (linha 68), adicionar telefone1_solicitante:
.select('numero, lead_id, vistoria_id, vendedor_id, telefone1_solicitante')

// Após exclusão bem-sucedida (~linha 299), antes do log de auditoria:
if (cotacao.telefone1_solicitante) {
  const telefoneNormalizado = cotacao.telefone1_solicitante.replace(/\D/g, '');
  await adminClient
    .from('agente_ia_contatos')
    .update({ status: 'novo', dados_cotacao: null })
    .eq('telefone', telefoneNormalizado);
  console.log(`[delete-cotacao] Contato IA resetado para telefone ${telefoneNormalizado}`);
}
```

### Deploy
Redeployar a edge function `delete-cotacao`.

