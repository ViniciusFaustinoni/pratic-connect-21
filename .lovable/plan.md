## Objetivo

Tornar o envio do WhatsApp **opcional** ao liberar associado(s) na tela **Monitoramento › Aprovações › Liberação de Suspensão**. Hoje o envio é automático e incondicional.

## Mudança de UX

No modal "Liberar X associado(s)" (`LiberacoesAutoVistoria.tsx`), adicionar um **Checkbox** logo acima dos botões do rodapé:

- Label: **"Enviar WhatsApp ao associado com link para reagendar"**
- Estado padrão: **marcado** (mantém o comportamento atual como default seguro)
- Quando desmarcado, o texto descritivo do modal muda sutilmente (some a parte "O associado receberá WhatsApp..."), ou aparece um aviso curto: "O associado **não** será notificado — avise por outro canal."

O campo "Motivo (opcional)" permanece igual.

## Mudanças técnicas

1. **`src/pages/monitoramento/LiberacoesAutoVistoria.tsx`**
   - Novo estado `enviarWhatsapp` (default `true`).
   - Resetar `enviarWhatsapp = true` em `abrirLiberar()`.
   - Renderizar Checkbox no `Dialog` de liberar.
   - Passar `enviar_whatsapp` na chamada `liberar.mutateAsync({ contrato_ids, motivo, enviar_whatsapp })`.

2. **`src/hooks/useLiberacoesAutoVistoria.ts`**
   - `useLiberarAutoVistoria`: aceitar `enviar_whatsapp?: boolean` (default `true`) no payload da mutation e repassar no `body` do invoke.
   - Ajustar `toast.success` para mostrar mensagem condicional: com WhatsApp ("WhatsApp enviado") vs sem ("sem notificação").

3. **`supabase/functions/liberar-reagendamento-autovistoria/index.ts`**
   - Ler `enviar_whatsapp` do body (default `true` para retrocompat).
   - Envolver o bloco do loop de WhatsApp (linhas 112–139) num `if (enviarWhatsapp)`.
   - Auditoria: incluir `enviar_whatsapp` em `dados_novos` para rastreabilidade.
   - Resposta: incluir `whatsapp_enviado: boolean`.

## Fora de escopo

- O modal de **Cancelar adesão** continua enviando WhatsApp automaticamente (não foi pedido).
- Sem alteração no botão "Liberar selecionados" em lote — a mesma flag se aplica naturalmente porque o modal é o mesmo.
- Sem migração de banco.
