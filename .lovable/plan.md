
# Enviar Link do Evento Diretamente via API do WhatsApp

## Problema

O botao "Enviar via WhatsApp" no card do link do evento (`EventoLinkCard.tsx`) abre o WhatsApp Web (`wa.me/...`) para o operador copiar e enviar manualmente. O correto e que a IA/sistema envie a mensagem diretamente pela Evolution API, sem abrir nenhuma conversa.

## Solucao

Alterar a funcao `handleWhatsApp` no componente `EventoLinkCard.tsx` para chamar a edge function `whatsapp-send-text` diretamente, seguindo o mesmo padrao ja usado em dezenas de outros locais do sistema (ex: `SinistroAnalise.tsx`, `EnviarLinkPrestadorButton.tsx`, etc).

## Alteracoes

### `src/components/eventos/EventoLinkCard.tsx`

1. Importar `supabase` e adicionar estado `enviando` para controle de loading
2. Substituir `handleWhatsApp` de `window.open(wa.me/...)` para `supabase.functions.invoke('whatsapp-send-text', { body: { telefone, mensagem } })`
3. Adicionar feedback visual: botao com loading spinner enquanto envia, toast de sucesso/erro
4. Formatar telefone corretamente (remover caracteres nao numericos)

### Detalhes Tecnicos

Funcao atual (abre WhatsApp Web):
```text
window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
```

Nova funcao (envia direto pela API):
```text
const { error } = await supabase.functions.invoke('whatsapp-send-text', {
  body: {
    telefone: phone,  // apenas numeros
    mensagem: `Olá ${associadoNome}! Segue o link para completar as etapas do seu evento (${sinistroProtocolo}):\n\n${linkUrl}\n\nO link é válido por 72 horas.\n\nABP PraticCar`
  }
});
```

O botao mostrara um Loader2 durante o envio e ficara desabilitado para evitar duplo clique.

| Arquivo | Alteracao |
|---|---|
| `src/components/eventos/EventoLinkCard.tsx` | Trocar `window.open(wa.me)` por chamada direta a `whatsapp-send-text` |
