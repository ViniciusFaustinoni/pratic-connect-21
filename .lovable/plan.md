

## Plano: Corrigir 3 problemas no fluxo do Agente Consultor IA

### Problemas
1. A IA diz "Encontrei 74 opções de plano" — não deveria informar quantidade
2. Pergunta sobre instalação (rota/base) na conversa — o cliente escolhe isso no link público
3. Ao enviar a data de vencimento, a conversa reiniciou com saudação inicial

### Solução

**Arquivo: `supabase/functions/agente-consultor-ia/index.ts`**

#### 1. Remover menção à quantidade de planos (linhas 397-401)
Substituir a instrução de dizer "Encontrei X opções" por algo genérico:
```
## REGRAS ABSOLUTAS SOBRE PREÇOS
- NUNCA informe valores de planos na conversa
- NUNCA liste planos com preços
- NUNCA informe a QUANTIDADE de planos encontrados
- Após calcular, diga apenas: "Vou preparar sua cotação personalizada com as melhores opções!"
```

#### 2. Remover pergunta sobre instalação do fluxo (linhas 407-410, 422, 442)
- Remover a seção "SOBRE ADESÃO E INSTALAÇÃO" que manda perguntar rota/base
- Remover o passo 9 do fluxo ("Pergunte sobre a instalação")
- Remover `tipo_instalacao` dos dados obrigatórios
- Remover `tipo_instalacao` do tool `registrar_cotacao`
- O fluxo passa a ser: placa → confirmar → uso/região → calcular → vencimento → email → nome → registrar

#### 3. Corrigir reinício de conversa (linhas 245-252, 566)
O problema: quando a IA envia a resposta com as opções de vencimento, essa mensagem é salva. Quando o usuário responde "15", o webhook é acionado novamente. Se o histórico não inclui as mensagens anteriores corretamente (ex: mensagens de tool calls não são salvas), a IA perde o contexto.

Investigar e corrigir: a condição `isPrimeiraMensagem` (linha 252) considera primeira mensagem quando `historico?.length === 0`. Se o histórico de 2h está vazio por algum motivo (ex: as mensagens foram salvas com telefone em formato diferente), a IA reinicia. A correção é garantir que `isPrimeiraMensagem` seja `false` quando há um contato existente com interações recentes, independente do histórico de mensagens:

```typescript
const isPrimeiraMensagem = !contatoExistente;
```

E manter o histórico formatado sendo enviado sempre que disponível (remover a condição `!isPrimeiraMensagem` da linha 566):

```typescript
const messages: any[] = [];
if (historicoFormatado.length > 0) {
  messages.push(...historicoFormatado);
}
```

### Arquivos alterados
- `supabase/functions/agente-consultor-ia/index.ts` (deploy necessário)

