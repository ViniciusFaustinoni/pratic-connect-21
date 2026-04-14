

## Plano: Limpar historico de mensagens ao resetar contato IA

### Problema
Quando a cotacao e excluida, o `delete-cotacao` reseta `status` e `dados_cotacao` em `agente_ia_contatos`. Porem, o agente carrega as ultimas 2h de mensagens da tabela `whatsapp_mensagens` (linha 200-209) como historico de conversa. O LLM ve toda a conversa anterior e continua de onde parou, ignorando o reset.

### Correcao

**Arquivo: `supabase/functions/agente-consultor-ia/index.ts`**

Apos carregar o estado do contato (linha 220-221), verificar se `status === "novo"` e `dados_cotacao` e null. Se sim, ignorar o historico de mensagens carregado -- tratar como primeira mensagem, enviando array vazio ao LLM.

```typescript
// Linha ~218, após historicoFormatado
const foiResetado = contatoExistente && contato?.status === 'novo' && !contato?.dados_cotacao;
const isPrimeiraMensagem = !contatoExistente || foiResetado;

// Se foi resetado, limpar histórico para o LLM não ter contexto antigo
if (foiResetado) {
  historicoFormatado.length = 0;
  console.log(`[agente-consultor-ia] Contato resetado detectado, limpando histórico`);
}
```

Isso garante que, ao excluir uma cotacao e o lead enviar nova mensagem, o agente comeca do zero sem memoria da conversa anterior.

### Deploy
Redeployar `agente-consultor-ia`.

