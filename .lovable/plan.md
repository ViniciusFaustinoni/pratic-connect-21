

# Fix: Template Meta Não Enviado na Atribuição Manual de Vistoria

## Causa Raiz

Dois problemas combinados impedem o envio:

1. **Edge function inexistente**: O hook `useAtribuicaoManual` chama `supabase.functions.invoke('enviar-template-meta')` — essa edge function **não existe**. A função correta é `whatsapp-send-text`.

2. **Formato de parâmetros errado**: O hook envia `variaveis: { '1': ..., '2': ... }` (objeto com chaves numéricas), mas `whatsapp-send-text` espera `template_params: [...]` (array de strings).

3. **Erro silencioso**: O `catch` apenas faz `console.error`, então a falha passa despercebida.

Como a atribuição automática (cron) está desligada ("Atribuição MANUAL ativa — motor automático desligado"), o fluxo que **funciona** (no cron) nunca roda. O fluxo manual é o único ativo e está quebrado.

## Solução

Corrigir o hook `useAtribuicaoManual` para:
- Chamar `whatsapp-send-text` em vez de `enviar-template-meta`
- Usar `template_params` (array) em vez de `variaveis` (objeto)
- Incluir `referencia_tipo` e `referencia_id` para rastreabilidade

## Arquivo Alterado

| Arquivo | Ação |
|---------|------|
| `src/hooks/useAtribuicaoManual.ts` | Corrigir chamada de edge function e formato de parâmetros |

## Detalhes Técnicos

### `useAtribuicaoManual.ts` — linhas 169-191

**Antes** (quebrado):
```ts
await supabase.functions.invoke('enviar-template-meta', {
  body: {
    telefone,
    template_name: 'servico_atribuido_v1',
    variaveis: { '1': ..., '2': ..., '3': ..., '4': ..., '5': ..., '6': ... },
  },
});
```

**Depois** (corrigido):
```ts
const enderecoCompleto = [servico?.logradouro, servico?.numero, servico?.bairro, servico?.cidade]
  .filter(Boolean).join(', ') || 'A definir';

await supabase.functions.invoke('whatsapp-send-text', {
  body: {
    telefone: telefone.replace(/\D/g, ''),
    mensagem: `Nova tarefa atribuída: ${servico?.tipo || 'Serviço'} - ${assocData?.nome || 'Cliente'}`,
    template_name: 'servico_atribuido_v1',
    template_params: [
      profissional.nome?.split(' ')[0] || 'Técnico',
      servico?.tipo || 'Serviço',
      `${assocData?.nome || 'Cliente'} - ${veicData?.placa || ''}`,
    ],
    referencia_tipo: 'servico',
    referencia_id: servicoId,
  },
});
```

Isso alinha o formato com o que o cron já usa com sucesso para instalações e vistorias, garantindo que o template `servico_atribuido_v1` seja enviado via Meta API ao técnico quando qualquer tarefa (vistoria, instalação, etc.) é atribuída manualmente.

